// Double progression: for each exercise, look at the last time it was done and
// suggest today's weight and reps. Work in a rep range (e.g. 6–8); once every
// working set reaches the top of the range, add weight and start again at the
// bottom. No program needed — only the exercise's own history.
import { EXERCISE_LIBRARY } from './exercises.js';
import { exerciseHistory } from './stats.js';
import { isoDate, fromIso, fmtDateShort } from './util.js';
import { sleepMinutes } from './analysis.js';

const LOWER_COMPOUND = ['squat', 'front squat', 'hack squat', 'deadlift', 'romanian deadlift', 'leg press', 'hip thrust', 'good morning'];
const UPPER_COMPOUND = [
  'bench press', 'incline bench press', 'decline bench press', 'dumbbell bench press', 'incline dumbbell press',
  'close-grip bench press', 'machine chest press', 'overhead press', 'dumbbell shoulder press', 'arnold press',
  'machine shoulder press', 'barbell row', 'one-arm dumbbell row', 'seated cable row', 't-bar row',
  'lat pulldown', 'close-grip lat pulldown', 'bulgarian split squat', 'lunges', 'goblet squat', 'single-leg deadlift'
];
const BODYWEIGHT = ['pull-ups', 'chin-ups', 'dips', 'chest dips', 'push-ups', 'diamond push-ups'];
const NO_PROGRESSION_GROUPS = ['Cardio', 'Core', 'Full Body', 'Forearms'];

const KIND_LABEL = {
  lower: 'Compound · noge',
  upper: 'Compound',
  bodyweight: 'Lastna teža',
  isolation: 'Izolacija',
  off: 'Brez predlogov'
};

function groupOf(name) {
  const n = name.trim().toLowerCase();
  for (const g of EXERCISE_LIBRARY) if (g.exercises.some(e => e.toLowerCase() === n)) return g.group;
  return null;
}

export function defaultRule(name) {
  const n = name.trim().toLowerCase();
  if (LOWER_COMPOUND.includes(n)) return { kind: 'lower', min: 6, max: 8, step: 5 };
  if (UPPER_COMPOUND.includes(n)) return { kind: 'upper', min: 6, max: 8, step: 2.5 };
  if (BODYWEIGHT.includes(n)) return { kind: 'bodyweight', min: 6, max: 12, step: 2.5 };
  if (NO_PROGRESSION_GROUPS.includes(groupOf(name))) return { kind: 'off', min: 10, max: 15, step: 2.5, off: true };
  // Isolation and custom exercises; cables and machines go up in 2.5 kg steps.
  return { kind: 'isolation', min: 10, max: 15, step: 2.5 };
}

export function ruleFor(data, name) {
  const custom = ((data.settings.progression || {})[name.trim().toLowerCase()]) || {};
  const rule = { ...defaultRule(name), ...custom };
  if (custom.off === false && rule.kind === 'off') rule.kind = 'isolation';
  return { ...rule, label: rule.off ? KIND_LABEL.off : KIND_LABEL[rule.kind] };
}

export function setRule(data, name, patch) {
  const key = name.trim().toLowerCase();
  data.settings.progression = data.settings.progression || {};
  data.settings.progression[key] = { ...(data.settings.progression[key] || {}), ...patch };
}

export function workingSets(session) {
  const sets = session.sets.map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })).filter(s => s.reps > 0);
  const top = Math.max(0, ...sets.map(s => s.kg));
  return { top, sets: sets.filter(s => s.kg === top) };
}

function roundTo(x, step) { return Math.max(step, Math.round(x / step) * step); }

function fmt(kg) { return Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ','); }

// Was today's morning entry bad enough that adding weight is a bad idea?
function poorReadiness(data, now) {
  const e = data.wellness[isoDate(now)];
  if (!e) return null;
  const sleep = sleepMinutes(e);
  if (sleep != null && sleep < 6 * 60) return 'premalo spanca';
  if (e.quality != null && e.quality <= 1) return 'slab spanec';
  if (e.stress != null && e.stress >= 8) return 'visok stres';
  return null;
}

// Suggestion for today, or null when there is nothing to base it on.
// { type: 'up' | 'reps' | 'hold' | 'deload' | 'first', kg, reps: [per working set], sets, title, reason, rule }
export function recommend(data, name, now = new Date()) {
  const rule = ruleFor(data, name);
  if (rule.off) return null;
  const todayIso = isoDate(now);
  const hist = exerciseHistory(data, name).filter(h => h.dateISO <= todayIso);
  if (!hist.length) return null;

  // A lighter-than-usual session (a bad day) shouldn't reset the baseline: when
  // the last working weight is at least 5 % under the session before it, suggest
  // from that earlier session. Two light sessions in a row are a new level
  // (cut, deload) and count as normal; so does a light session that was the
  // deload this function asked for.
  if (hist.length >= 2) {
    const last = hist[hist.length - 1], prev = hist[hist.length - 2];
    const lt = workingSets(last).top, pt = workingSets(prev).top;
    const gapDays = Math.round((fromIso(last.dateISO) - fromIso(prev.dateISO)) / 86400000);
    if (lt > 0 && pt > 0 && lt < pt * 0.95 && gapDays <= 28) {
      const base = suggestFrom(data, hist.slice(0, -1), rule, now);
      if (base && base.type !== 'deload') {
        return { ...base, last: `${base.last} (${fmtDateShort(fromIso(prev.dateISO))})`,
          note: `Zadnji trening (${fmt(lt)} kg) je bil lažji, zato ga predlog ne upošteva.` };
      }
    }
  }
  return suggestFrom(data, hist, rule, now);
}

function suggestFrom(data, hist, rule, now) {
  const last = workingSets(hist[hist.length - 1]);
  if (!last.sets.length) return null;
  const reps = last.sets.map(s => s.reps);
  const n = last.sets.length;
  const lastText = `${last.top ? fmt(last.top) + ' kg' : 'lastna teža'} × ${reps.join(', ')}`;
  const range = `${rule.min}–${rule.max}`;
  const allTop = reps.every(r => r >= rule.max);
  const below = reps.some(r => r < rule.min);

  // Two sessions in a row under the range at the same weight → back off.
  if (below && hist.length >= 2 && last.top > 0) {
    const prev = workingSets(hist[hist.length - 2]);
    if (prev.top === last.top && prev.sets.some(s => s.reps < rule.min)) {
      const kg = roundTo(last.top * 0.9, rule.step);
      return { type: 'deload', kg, reps: Array(n).fill(rule.max), sets: n, rule, title: `${fmt(kg)} kg × ${rule.max}`,
        reason: `Dvakrat zapored pod ${rule.min} ponovitev pri ${fmt(last.top)} kg — zmanjšaj za ~10 % in gradi nazaj.`, last: lastText };
    }
  }

  if (allTop) {
    const readiness = poorReadiness(data, now);
    if (readiness) {
      return { type: 'hold', kg: last.top, reps: Array(n).fill(rule.max), sets: n, rule, title: `${last.top ? fmt(last.top) + ' kg' : 'lastna teža'} × ${rule.max}`,
        reason: `Zadnjič vse na vrhu razpona ${range}, a danes ${readiness} — drži težo, dvigni naslednjič.`, last: lastText };
    }
    const kg = last.top + rule.step;
    return { type: 'up', kg, reps: Array(n).fill(rule.min), sets: n, rule, title: `${last.top ? '' : '+'}${fmt(kg)} kg${last.top ? '' : ' uteži'} × ${rule.min}–${rule.max}`,
      reason: last.top
        ? `Zadnjič vse serije na vrhu razpona ${range} — dodaj ${fmt(rule.step)} kg.`
        : `Zadnjič vse serije na ${rule.max}+ — čas je za dodatno utež (${fmt(rule.step)} kg).`, last: lastText };
  }

  const target = below ? Array(n).fill(rule.min) : reps.map(r => Math.min(rule.max, r + 1));
  return { type: 'reps', kg: last.top, reps: target, sets: n, rule, title: `${last.top ? fmt(last.top) + ' kg' : 'lastna teža'} × ${target.join(', ')}`,
    reason: below
      ? `Zadnjič pod ${rule.min} ponovitev — ista teža, cilj ${rule.min} v vsaki seriji.`
      : `Ista teža, dodaj ponovitev — ko so vse serije na ${rule.max}, dvigneš težo.`, last: lastText };
}
