// Schedules phone notifications for the next week based on reminders.js.
// Re-run whenever data changes or the app resumes, so reminders for things
// that are already logged get cancelled and new ones get planned.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isoDate, addDays, dowMon, startOfWeek } from './util.js';
import { trainingNeed, REMIND_TIMES, morningTime } from './reminders.js';

const ID_BASE = 1000;
const ID_SPAN = 100;
const DAYS_AHEAD = 7;

function at(date, { h, m }) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
}

// Minutes after the morning time at which the check-in reminder repeats,
// as long as the day is still not logged.
const MORNING_REPEATS = [0, 60, 120, 180, 300, 540];
const MORNING_TEXTS = [
  ['Dobro jutro ☀️', 'Jutranji vpis: teža, spanec, stres — 20 sekund.'],
  ['Jutranji vpis čaka', 'Stehtaj se in vpiši, kako si spal.'],
  ['Še vedno brez vpisa', 'Brez vpisov analiza ne ve, kaj vpliva na tvoje lifte.'],
  ['Jutranji vpis', 'Danes še nisi vpisal teže in spanca.'],
  ['Niz vpisov je v nevarnosti', 'Vpiši današnji dan, da ne prekineš niza.'],
  ['Še vedno nič?', 'Vpis traja 20 sekund. Daj, odpri aplikacijo.']
];

export function planNotifications(data, now = new Date()) {
  const t = data.settings.toggles || {};
  const out = [];
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = addDays(now, d);
    const iso = isoDate(day);
    const logged = !!data.wellness[iso];

    if (t.remindMorning !== false && !logged) {
      const start = at(day, morningTime(data.settings));
      MORNING_REPEATS.forEach((mins, k) => {
        const [title, body] = MORNING_TEXTS[k];
        out.push({ id: ID_BASE + d * 10 + k, title, body, at: new Date(start.getTime() + mins * 60000) });
      });
      const evening = at(day, REMIND_TIMES.evening);
      if (evening > new Date(start.getTime() + MORNING_REPEATS[MORNING_REPEATS.length - 1] * 60000)) {
        out.push({ id: ID_BASE + d * 10 + 6, title: 'Zadnji klic za danes', body: 'Današnji dan še ni vpisan.', at: evening });
      }
    }
    if (t.remindTraining !== false && !(d === 0 && data.activeWorkout)) {
      const need = trainingNeed(data, day);
      if (need) out.push({ id: ID_BASE + d * 10 + 8, title: need.urgent ? 'Danes je dan za trening 💪' : 'Čas je za trening', body: need.reason + '.', at: at(day, REMIND_TIMES.training) });
    }
    if (t.reportWeekly !== false && dowMon(day) === 6) {
      out.push({ id: ID_BASE + d * 10 + 9, title: 'Tedensko poročilo 📊', body: 'Poglej, kako je šlo ta teden in na kaj se osredotočiti naslednji.', at: at(day, REMIND_TIMES.report),
        extra: { route: 'porocilo', params: { kind: 'week', date: isoDate(startOfWeek(day)) } } });
    }
    const lastOfMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
    if (t.reportMonthly !== false && day.getDate() === lastOfMonth) {
      out.push({ id: ID_BASE + 80 + d, title: 'Mesečno poročilo 📈', body: 'Mesec je naokoli — poglej napredek, rekorde in platoje.', at: at(day, { h: REMIND_TIMES.report.h, m: REMIND_TIMES.report.m + 1 }),
        extra: { route: 'porocilo', params: { kind: 'month', date: isoDate(new Date(day.getFullYear(), day.getMonth(), 1)) } } });
    }
  }
  return out.filter(n => n.at > now);
}

let chain = Promise.resolve();
let timer = null;

async function sync(data) {
  if (!Capacitor.isNativePlatform()) return;
  const planned = planNotifications(data);
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
    if (!planned.length) return;
    perm = await LocalNotifications.requestPermissions();
  }
  if (perm.display !== 'granted') return;

  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter(n => n.id >= ID_BASE && n.id < ID_BASE + ID_SPAN);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) });
  if (!planned.length) return;
  await LocalNotifications.schedule({
    notifications: planned.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true }, extra: n.extra || null }))
  });
}

// Opens the screen a notification points to (e.g. a report) when it is tapped.
export function onNotificationOpen(handler) {
  if (!Capacitor.isNativePlatform()) return;
  LocalNotifications.addListener('localNotificationActionPerformed', ev => {
    const extra = ev && ev.notification && ev.notification.extra;
    if (extra && extra.route) handler(extra.route, extra.params);
  }).catch(() => {});
}

export function syncNotifications(data, delayMs = 800) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    chain = chain.then(() => sync(data)).catch(err => console.warn('Opomniki:', err));
  }, delayMs);
}
