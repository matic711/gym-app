// Schedules phone notifications for the next week based on reminders.js.
// Re-run whenever data changes or the app resumes, so reminders for things
// that are already logged get cancelled and new ones get planned.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isoDate, addDays } from './util.js';
import { trainingNeed, REMIND_TIMES } from './reminders.js';

const ID_BASE = 1000;
const ID_SPAN = 100;
const DAYS_AHEAD = 7;

function at(date, { h, m }) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0);
}

export function planNotifications(data, now = new Date()) {
  const t = data.settings.toggles || {};
  const out = [];
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = addDays(now, d);
    const iso = isoDate(day);
    const logged = !!data.wellness[iso];

    if (t.remindWeigh && t.trackWeight && !logged) {
      out.push({ id: ID_BASE + d * 3, title: 'Tehtanje', body: 'Stehtaj se in vpiši težo.', at: at(day, REMIND_TIMES.weigh) });
    }
    if (t.remindTraining !== false && !(d === 0 && data.activeWorkout)) {
      const need = trainingNeed(data, day);
      if (need) out.push({ id: ID_BASE + d * 3 + 1, title: need.urgent ? 'Danes je dan za trening 💪' : 'Čas je za trening', body: need.reason + '.', at: at(day, REMIND_TIMES.training) });
    }
    if (t.remindMood && !logged) {
      out.push({ id: ID_BASE + d * 3 + 2, title: 'Vpiši današnji dan', body: 'Spanec, počutje in energija — traja 20 sekund.', at: at(day, REMIND_TIMES.mood) });
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
    notifications: planned.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } }))
  });
}

export function syncNotifications(data, delayMs = 800) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    chain = chain.then(() => sync(data)).catch(err => console.warn('Opomniki:', err));
  }, delayMs);
}
