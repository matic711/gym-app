// Training form analysis: how sleep, stress, energy and bodyweight relate to
// lift performance, and whether strength is trending down over the last weeks
// once bodyweight changes (e.g. a cut) are taken into account.
import { isoDate, addDays, fromIso, workoutVolume } from './util.js';
import { e1rm } from './stats.js';

const DAY_MS = 86400000;
const WINDOW_DAYS = 28;

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}
function daysApart(aIso, bIso) { return Math.round((fromIso(bIso) - fromIso(aIso)) / DAY_MS); }

export function sleepMinutes(e) {
  if (!e || !e.bed || !e.wake) return null;
  const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  let d = toMin(e.wake) - toMin(e.bed);
  if (d < 0) d += 1440;
  return d;
}

// Bodyweight logged on that day, or the closest day within ±3 days.
function weightNear(data, iso) {
  for (let off = 0; off <= 3; off++) {
    for (const sign of off ? [-1, 1] : [1]) {
      const e = data.wellness[isoDate(addDays(fromIso(iso), sign * off))];
      if (e && e.weight) return e.weight;
    }
  }
  return null;
}

// How strong one exercise was in one workout. Sets with different rep counts
// are made comparable with an estimate; the number itself is never shown,
// only how it compares to the lifter's own recent sessions.
function strengthIndex(ex) {
  let best = 0;
  for (const s of ex.sets) {
    const reps = Number(s.reps) || 0;
    if (reps > 0 && reps <= 15) best = Math.max(best, e1rm(s.kg, reps));
  }
  return best;
}

export function exerciseSessions(data) {
  const byEx = new Map();
  const workouts = [...data.workouts].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const idx = strengthIndex(ex);
      if (!idx) continue;
      const key = ex.name.trim().toLowerCase();
      if (!byEx.has(key)) byEx.set(key, []);
      byEx.get(key).push({ workoutId: w.id, dateISO: w.dateISO, idx, bw: weightNear(data, w.dateISO) });
    }
  }
  return byEx;
}

// Per workout: how much stronger/weaker than the median of the previous
// sessions of the same exercises (e.g. +0.04 = 4 % stronger than usual).
export function sessionPerformances(data) {
  const byEx = exerciseSessions(data);
  const perWorkout = new Map();
  for (const sessions of byEx.values()) {
    sessions.forEach((s, i) => {
      const prev = sessions.slice(0, i).filter(p => daysApart(p.dateISO, s.dateISO) <= 120).slice(-6);
      if (prev.length < 2) return;
      const rel = s.idx / median(prev.map(p => p.idx)) - 1;
      if (!perWorkout.has(s.workoutId)) perWorkout.set(s.workoutId, { dateISO: s.dateISO, parts: [] });
      perWorkout.get(s.workoutId).parts.push(rel);
    });
  }
  return [...perWorkout.entries()]
    .map(([id, v]) => ({ id, dateISO: v.dateISO, perf: mean(v.parts), n: v.parts.length }))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export const FACTORS = [
  { key: 'sleep', label: 'Trajanje spanca', more: 'Ob več spanca', get: e => sleepMinutes(e) },
  { key: 'quality', label: 'Kakovost spanca', more: 'Ob boljšem spancu', get: e => e.quality },
  { key: 'stress', label: 'Stres', more: 'Ob več stresa', get: e => e.stress },
  { key: 'energy', label: 'Energija', more: 'Ob več energije', get: e => e.energy },
  { key: 'weight', label: 'Telesna teža', more: 'Ob višji teži', get: e => e.weight }
];

const MIN_SESSIONS = 8;

// For each factor: split the workouts at the median value of the factor and
// compare the average performance of the two halves.
export function factorEffects(data, perfs) {
  return FACTORS.map(f => {
    const pairs = [];
    for (const p of perfs) {
      const e = data.wellness[p.dateISO];
      const v = e ? f.get(e) : null;
      if (v != null && !Number.isNaN(v)) pairs.push({ v, perf: p.perf });
    }
    if (pairs.length < MIN_SESSIONS) return { ...f, enough: false, reason: 'few', n: pairs.length };
    const threshold = median(pairs.map(p => p.v));
    const high = pairs.filter(p => p.v > threshold), low = pairs.filter(p => p.v <= threshold);
    if (high.length < 3 || low.length < 3) return { ...f, enough: false, reason: 'flat', n: pairs.length };
    const diff = mean(high.map(p => p.perf)) - mean(low.map(p => p.perf));
    const r = pearson(pairs.map(p => p.v), pairs.map(p => p.perf));
    const a = Math.abs(r);
    const strength = a >= 0.5 ? 'močna' : a >= 0.3 ? 'zmerna' : a >= 0.15 ? 'šibka' : 'ni opazna';
    return { ...f, enough: true, n: pairs.length, threshold, diff, r, strength };
  });
}

function windowMean(list, from, to, pick) {
  return mean(list.filter(x => x.dateISO >= from && x.dateISO <= to).map(pick).filter(v => v != null));
}

// Last 4 weeks vs the 4 weeks before: absolute strength, strength per kg of
// bodyweight, bodyweight, volume, training frequency and logging consistency.
export function trend(data, now = new Date()) {
  const curFrom = isoDate(addDays(now, -(WINDOW_DAYS - 1))), curTo = isoDate(now);
  const prevFrom = isoDate(addDays(now, -(2 * WINDOW_DAYS - 1))), prevTo = isoDate(addDays(now, -WINDOW_DAYS));

  const abs = [], rel = [];
  for (const sessions of exerciseSessions(data).values()) {
    const a1 = windowMean(sessions, curFrom, curTo, s => s.idx), a0 = windowMean(sessions, prevFrom, prevTo, s => s.idx);
    if (a1 == null || a0 == null) continue;
    abs.push(a1 / a0 - 1);
    const r1 = windowMean(sessions, curFrom, curTo, s => s.bw ? s.idx / s.bw : null), r0 = windowMean(sessions, prevFrom, prevTo, s => s.bw ? s.idx / s.bw : null);
    if (r1 != null && r0 != null) rel.push(r1 / r0 - 1);
  }

  const wellnessList = Object.entries(data.wellness).map(([dateISO, e]) => ({ dateISO, e }));
  const w1 = windowMean(wellnessList, curFrom, curTo, x => x.e.weight || null), w0 = windowMean(wellnessList, prevFrom, prevTo, x => x.e.weight || null);

  const inCur = data.workouts.filter(w => w.dateISO >= curFrom && w.dateISO <= curTo);
  const inPrev = data.workouts.filter(w => w.dateISO >= prevFrom && w.dateISO <= prevTo);
  const v1 = inCur.reduce((s, w) => s + workoutVolume(w), 0), v0 = inPrev.reduce((s, w) => s + workoutVolume(w), 0);

  // Days that could have been logged (today only counts once it's logged).
  const todayLogged = !!data.wellness[curTo];
  const firstLog = Object.keys(data.wellness).sort()[0];
  let possible = 0, logged = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const iso = isoDate(addDays(now, -i));
    if (i === 0 && !todayLogged) continue;
    if (firstLog && iso < firstLog) break;
    possible++;
    if (data.wellness[iso]) logged++;
  }

  const recentFrom = isoDate(addDays(now, -13));
  return {
    exCount: abs.length,
    absChange: mean(abs),
    relChange: rel.length ? mean(rel) : null,
    weightChange: w1 != null && w0 != null ? w1 / w0 - 1 : null,
    weightNow: w1, weightBefore: w0,
    volumeChange: v0 ? v1 / v0 - 1 : null,
    perWeek: inCur.length / (WINDOW_DAYS / 7),
    hasPrevTraining: inPrev.length > 0,
    logRate: possible ? logged / possible : null, loggedDays: logged, possibleDays: possible,
    recentSleep: windowMean(wellnessList, recentFrom, curTo, x => sleepMinutes(x.e)),
    recentStress: windowMean(wellnessList, recentFrom, curTo, x => x.e.stress)
  };
}

function pct(x) { return `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 1000) / 10).toFixed(1).replace('.', ',')} %`; }
function hm(min) { return `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`; }

// Everything the "Forma" screen and the Domov warning need.
// items: [{ level: 'bad' | 'warn' | 'good' | 'info', title, text }]
export function formReport(data, now = new Date()) {
  const perfs = sessionPerformances(data);
  const factors = factorEffects(data, perfs);
  const t = trend(data, now);
  const goal = data.settings.goalPerWeek || 0;
  const items = [];

  let strengthLevel = null;
  if (!t.exCount) {
    items.push({ level: 'info', title: 'Premalo podatkov za trend', text: 'Primerjava moči potrebuje treninge z istimi vajami v zadnjih 4 tednih in v 4 tednih pred tem.' });
  } else {
    const A = t.absChange, R = t.relChange, W = t.weightChange;
    if (R != null && R <= -0.03) {
      strengthLevel = 'bad';
      items.push({ level: 'bad', title: 'Nazaduješ', text: `Glede na telesno težo si v zadnjih 4 tednih šibkejši za ${pct(R).slice(1)} kot prej. Tega ne pojasni sprememba teže.` });
    } else if (R == null && A <= -0.04) {
      strengthLevel = 'bad';
      items.push({ level: 'bad', title: 'Nazaduješ', text: `Moč je v zadnjih 4 tednih ${pct(A)} glede na prejšnje 4 tedne. Vpisuj težo, da bo analiza upoštevala tudi cut.` });
    } else if (A <= -0.02 && W != null && W < -0.01 && R != null) {
      strengthLevel = 'info';
      items.push({ level: 'info', title: 'Moč pada zaradi nižje teže', text: `Absolutno ${pct(A)}, teža ${pct(W)}, glede na težo pa ${pct(R)}. Med cutom je to pričakovano — ne lenariš.` });
    } else if (A >= 0.02 || (R != null && R >= 0.02)) {
      strengthLevel = 'good';
      items.push({ level: 'good', title: 'Napreduješ', text: `Moč ${pct(A)}${R != null ? `, glede na težo ${pct(R)}` : ''} v primerjavi s prejšnjimi 4 tedni.` });
    } else {
      strengthLevel = 'warn';
      items.push({ level: 'warn', title: 'Stagnacija', text: `Moč ${pct(A)}${R != null ? `, glede na težo ${pct(R)}` : ''} — zadnje 4 tedne ni napredka.` });
    }
  }

  if (goal && (t.hasPrevTraining || t.perWeek > 0) && t.perWeek < goal - 0.5) {
    items.push({ level: 'warn', title: 'Premalo treningov', text: `Zadnje 4 tedne ${String(Math.round(t.perWeek * 10) / 10).replace('.', ',')} treninga na teden, cilj je ${goal}.` });
  }
  if (t.volumeChange != null && t.volumeChange <= -0.2) {
    items.push({ level: 'warn', title: 'Manj volumna', text: `Skupni volumen je ${pct(t.volumeChange)} glede na prejšnje 4 tedne.` });
  }
  if (t.logRate != null && t.possibleDays >= 7 && t.logRate < 0.8) {
    items.push({ level: 'warn', title: 'Vpisi niso redni', text: `Vpisal si ${t.loggedDays} od ${t.possibleDays} dni. Brez rednih vpisov analiza ne more ugotoviti, kaj vpliva na tvoje lifte.` });
  }

  // Likely causes, only when strength is not going well.
  if (strengthLevel === 'bad' || strengthLevel === 'warn') {
    const sleep = factors.find(f => f.key === 'sleep');
    if (sleep.enough && sleep.diff >= 0.02 && t.recentSleep != null && t.recentSleep < sleep.threshold) {
      items.push({ level: 'warn', title: 'Možen vzrok: spanec', text: `Zadnja 2 tedna spiš povprečno ${hm(t.recentSleep)}. Ko spiš več kot ${hm(sleep.threshold)}, si v povprečju ${pct(sleep.diff).slice(1)} močnejši.` });
    }
    const stress = factors.find(f => f.key === 'stress');
    if (stress.enough && stress.diff <= -0.02 && t.recentStress != null && t.recentStress > stress.threshold) {
      items.push({ level: 'warn', title: 'Možen vzrok: stres', text: `Zadnja 2 tedna je stres povprečno ${String(Math.round(t.recentStress * 10) / 10).replace('.', ',')}/10. Ob stresu nad ${String(Math.round(stress.threshold * 10) / 10).replace('.', ',')} si v povprečju ${pct(-stress.diff).slice(1)} šibkejši.` });
    }
  }

  const slacking = items.some(i => i.level === 'bad') || items.filter(i => i.level === 'warn').length >= 2;
  return { perfs, factors, trend: t, items, slacking };
}

export { pct, hm };
