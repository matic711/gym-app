// Decides what the user still has to log. Used both for the "Za vpisati" card
// on Domov and for scheduling phone notifications (notifications.js).
import { isoDate, addDays, fromIso, startOfWeek, dowMon } from './util.js';

const DAY_MS = 86400000;

export const REMIND_TIMES = {
  training: { h: 18, m: 0 },
  evening: { h: 21, m: 0 }
};

export function morningTime(settings) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(settings.morningTime || '');
  return m ? { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) } : { h: 7, m: 30 };
}

// The app stays locked on the morning check-in until today's entry exists.
export function needsMorningCheckin(data, now = new Date()) {
  const t = data.settings.toggles || {};
  if (t.morningGate === false || !tracksWellness(t)) return false;
  if (now.getHours() < 4) return false; // still "last night"
  return !data.wellness[isoDate(now)];
}

function daysBetween(fromIsoStr, toDate) {
  return Math.round((new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()) - fromIso(fromIsoStr)) / DAY_MS);
}

// Days since the last workout after which a nudge is due for the weekly goal,
// e.g. goal 4 → 3 days, goal 3 → 4 days, goal 2 → 5 days.
export function maxRestDays(goal) {
  return Math.max(2, Math.ceil(7 / Math.max(1, goal)) + 1);
}

function lastWorkoutIso(data, beforeOrOnIso) {
  let best = null;
  for (const w of data.workouts) if (w.dateISO <= beforeOrOnIso && (!best || w.dateISO > best)) best = w.dateISO;
  return best;
}

// Would the user need to train on `date`, assuming nothing more gets logged
// between now and then? Returns null, or { urgent, reason }.
export function trainingNeed(data, date) {
  const goal = data.settings.goalPerWeek || 0;
  if (!goal) return null;
  const iso = isoDate(date);
  if (data.workouts.some(w => w.dateISO === iso)) return null;

  const weekStartIso = isoDate(startOfWeek(date));
  const doneThisWeek = data.workouts.filter(w => w.dateISO >= weekStartIso && w.dateISO < iso).length;
  const remaining = goal - doneThisWeek;
  const daysLeft = 7 - dowMon(date); // including `date`
  if (remaining > 0 && remaining > daysLeft) {
    return { urgent: true, reason: `Ta teden šele ${doneThisWeek} od ${goal} treningov` };
  }
  if (remaining > 0 && remaining === daysLeft) {
    return { urgent: true, reason: daysLeft === 1 ? 'Danes je zadnja priložnost za tedenski cilj' : `Še ${remaining} do tedenskega cilja v ${daysLeft} dneh` };
  }

  if (remaining <= 0) return null; // weekly goal already reached

  const last = lastWorkoutIso(data, iso);
  if (!last) return { urgent: false, reason: 'Zabeleži svoj prvi trening' };
  const gap = daysBetween(last, date);
  if (gap >= maxRestDays(goal)) {
    return { urgent: gap >= maxRestDays(goal) + 2, reason: `Zadnji trening pred ${gap} dnevi` };
  }
  return null;
}

// Consecutive days with a wellness entry, ending today (or yesterday if today
// isn't logged yet, so the streak doesn't look broken first thing in the morning).
export function logStreak(data, now = new Date()) {
  let d = now;
  if (!data.wellness[isoDate(d)]) d = addDays(d, -1);
  let n = 0;
  while (data.wellness[isoDate(d)]) { n++; d = addDays(d, -1); }
  return n;
}

function tracksWellness(t) {
  return t.trackWeight || t.trackSleep || t.trackMood || t.trackEnergy || t.trackStress;
}

// Everything the user should log right now, most urgent first.
export function computeReminders(data, now = new Date()) {
  const out = [];
  const t = data.settings.toggles || {};
  const todayIso = isoDate(now);
  const hour = now.getHours() + now.getMinutes() / 60;

  const aw = data.activeWorkout;
  if (aw && now - aw.startedAt > 3 * 3600 * 1000) {
    out.push({ key: 'active', urgent: true, title: 'Trening še teče', sub: 'Končaj ga, da se shrani v zgodovino', cta: 'Odpri', route: 'nov' });
  }

  if (!aw) {
    const need = trainingNeed(data, now);
    if (need) out.push({ key: 'training', urgent: need.urgent, title: need.urgent ? 'Danes je dan za trening' : 'Čas je za trening', sub: need.reason, cta: 'Začni', route: 'trening' });
  }

  if (tracksWellness(t)) {
    if (!data.wellness[todayIso]) {
      const parts = [t.trackWeight && 'teža', t.trackSleep && 'spanec', t.trackMood && 'počutje', t.trackEnergy && 'energija'].filter(Boolean);
      const mt = morningTime(data.settings);
      out.push({
        key: 'wellness', urgent: hour >= mt.h + mt.m / 60 + 2,
        title: 'Jutranji vpis', sub: parts.join(', ').replace(/^./, c => c.toUpperCase()),
        cta: 'Vpiši', route: 'zdravje'
      });
    }
    const yIso = isoDate(addDays(now, -1));
    const hasHistory = Object.keys(data.wellness).some(k => k < yIso);
    if (hasHistory && !data.wellness[yIso]) {
      out.push({ key: 'wellnessYesterday', urgent: false, title: 'Manjka včerajšnji vpis', sub: 'Dopolni ga, dokler se še spomniš', cta: 'Dopolni', route: 'zdravje', params: { date: yIso } });
    }
  }

  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
