// Plateau detection: an exercise that is trained regularly but has not
// progressed — no heavier working weight and no more reps at the best
// weight — for several weeks. Lighter sessions (bad days, deloads) neither
// count as progress nor reset anything.
import { exerciseHistory, allExercises } from './stats.js';
import { workingSets, progressionSets, effectiveRule } from './progression.js';
import { isoDate, addDays, fromIso } from './util.js';
import { sleepMinutes } from './analysis.js';

const DAY_MS = 86400000;
const MIN_SESSIONS_SINCE = 4;   // sessions after the last progress
const ACTIVE_DAYS = 21;         // exercise must have been done this recently

export function plateauWeeks(settings) {
  const n = Number(settings.plateauWeeks);
  return n >= 2 && n <= 16 ? n : 4;
}

const VARIATIONS = {
  'bench press': ['Incline Bench Press', 'Dumbbell Bench Press', 'Close-grip Bench Press'],
  'incline bench press': ['Incline Dumbbell Press', 'Bench Press'],
  'dumbbell bench press': ['Bench Press', 'Incline Dumbbell Press'],
  'squat': ['Front Squat', 'Hack Squat', 'Bulgarian Split Squat'],
  'front squat': ['Squat', 'Hack Squat'],
  'deadlift': ['Romanian Deadlift', 'Hip Thrust'],
  'romanian deadlift': ['Deadlift', 'Single-leg Deadlift'],
  'overhead press': ['Dumbbell Shoulder Press', 'Arnold Press'],
  'dumbbell shoulder press': ['Overhead Press', 'Machine Shoulder Press'],
  'barbell row': ['T-Bar Row', 'Seated Cable Row', 'One-arm Dumbbell Row'],
  'lat pulldown': ['Pull-ups', 'Close-grip Lat Pulldown'],
  'pull-ups': ['Chin-ups', 'Lat Pulldown'],
  'leg press': ['Hack Squat', 'Bulgarian Split Squat']
};

function daysBetween(aIso, bIso) { return Math.round((fromIso(bIso) - fromIso(aIso)) / DAY_MS); }
function fmtKg(kg) { return Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ','); }

function sessionScore(session, rule) {
  const ws = rule ? progressionSets(session, rule) : workingSets(session);
  const reps = ws.sets.map(s => s.reps);
  return { top: ws.top, maxReps: reps.length ? Math.max(...reps) : 0, totalReps: reps.reduce((a, b) => a + b, 0), sets: ws.sets.length };
}

// Dates on which the exercise progressed (first session counts as the start).
export function progressDates(hist, rule) {
  const out = [];
  let best = null;
  for (const h of hist) {
    const s = sessionScore(h, rule);
    if (!s.sets) continue;
    if (!best) { best = s; out.push(h.dateISO); continue; }
    const progressed = s.top > best.top || (s.top === best.top && (s.maxReps > best.maxReps || s.totalReps > best.totalReps));
    if (progressed) out.push(h.dateISO);
    if (s.top > best.top) best = s;
    else if (s.top === best.top) best = { ...best, maxReps: Math.max(best.maxReps, s.maxReps), totalReps: Math.max(best.totalReps, s.totalReps) };
  }
  return out;
}

function avgWellness(data, fromIsoStr, toIsoStr, pick) {
  const vals = Object.entries(data.wellness).filter(([iso]) => iso >= fromIsoStr && iso <= toIsoStr).map(([, e]) => pick(e)).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function weightAround(data, iso) {
  return avgWellness(data, isoDate(addDays(fromIso(iso), -3)), isoDate(addDays(fromIso(iso), 3)), e => e.weight || null);
}

// Plateau info for one exercise, or null.
export function plateauFor(data, name, now = new Date()) {
  const todayIso = isoDate(now);
  const hist = exerciseHistory(data, name).filter(h => h.dateISO <= todayIso);
  if (hist.length < MIN_SESSIONS_SINCE + 1) return null;
  const last = hist[hist.length - 1];
  if (daysBetween(last.dateISO, todayIso) > ACTIVE_DAYS) return null;

  const rule = effectiveRule(data, name);
  const dates = progressDates(hist, rule);
  const lastProgress = dates[dates.length - 1];
  const since = hist.filter(h => h.dateISO > lastProgress).length;
  const days = daysBetween(lastProgress, todayIso);
  const weeks = plateauWeeks(data.settings);
  if (since < MIN_SESSIONS_SINCE || days < weeks * 7) return null;

  const best = hist.filter(h => h.dateISO <= lastProgress).map(h => sessionScore(h, rule)).reduce((a, s) => (s.top > a.top ? s : a), { top: 0, maxReps: 0 });
  const lastScore = sessionScore(last, rule);

  // On a cut, flat strength while bodyweight drops is not a plateau to fix.
  const w0 = weightAround(data, lastProgress), w1 = weightAround(data, todayIso);
  const weightChange = w0 && w1 ? w1 / w0 - 1 : null;
  const cut = weightChange != null && weightChange <= -0.02;

  const tips = [];
  if (cut) {
    tips.push({ key: 'cut', text: `Telesna teža je od zadnjega napredka ${String(Math.round(weightChange * 1000) / 10).replace('.', ',').replace('-', '−')} % — med cutom je držanje moči že uspeh.` });
  } else {
    const from14 = isoDate(addDays(now, -13));
    const sleep = avgWellness(data, from14, todayIso, sleepMinutes);
    const stress = avgWellness(data, from14, todayIso, e => e.stress);
    if (sleep != null && sleep < 7 * 60) tips.push({ key: 'sleep', text: `Najprej spanec: zadnja 2 tedna povprečno ${Math.floor(sleep / 60)} h ${String(Math.round(sleep % 60)).padStart(2, '0')} min. Pod 7 h je napredek težji.` });
    if (stress != null && stress >= 7) tips.push({ key: 'stress', text: `Stres je zadnja 2 tedna povprečno ${String(Math.round(stress * 10) / 10).replace('.', ',')}/10 — to zavira okrevanje.` });
    const hadDeload = hist.some(h => h.dateISO > lastProgress && sessionScore(h, rule).top > 0 && sessionScore(h, rule).top <= best.top * 0.92);
    let deloadKg = Math.floor(best.top * 0.9 / 2.5) * 2.5;
    if (deloadKg >= best.top) deloadKg = best.top - 2.5;
    if (best.top > 0 && deloadKg > 0 && !hadDeload) {
      tips.push({ key: 'deload', text: `Deload: en teden z ~10 % manj (${fmtKg(deloadKg)} kg), nato nazaj na ${fmtKg(best.top)} kg.` });
    }
    if (!rule.off) {
      // Heavy compounds: go lighter for more reps; high-rep work: go heavier for fewer.
      tips.push({ key: 'range', text: rule.max <= 10
        ? `Spremeni razpon: ${rule.max}–${rule.max + 2} ponovitev za 4 tedne z nekoliko manjšo težo, potem nazaj na ${rule.min}–${rule.max}.`
        : `Spremeni razpon: ${Math.max(5, rule.min - 4)}–${rule.min - 1} ponovitev za 4 tedne z večjo težo, potem nazaj na ${rule.min}–${rule.max}.` });
    }
    if (lastScore.sets && lastScore.sets <= 3) tips.push({ key: 'set', text: `Dodaj serijo (${lastScore.sets} → ${lastScore.sets + 1}) za nekaj tednov.` });
    const vars = VARIATIONS[name.trim().toLowerCase()];
    if (vars) tips.push({ key: 'variation', text: `Zamenjaj varianto za 4–6 tednov: ${vars.join(', ')}.` });
  }

  return {
    name, days, weeks: Math.floor(days / 7), sessions: since, long: days >= 8 * 7, cut,
    lastProgress, best: best.top ? `${fmtKg(best.top)} kg × ${best.maxReps}` : `${best.maxReps} pon.`, tips
  };
}

// All exercises currently on a plateau, longest first.
export function detectPlateaus(data, now = new Date()) {
  return allExercises(data)
    .map(e => plateauFor(data, e.name, now))
    .filter(Boolean)
    .sort((a, b) => b.days - a.days);
}
