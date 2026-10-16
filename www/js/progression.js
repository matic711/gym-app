// Double progression: for each exercise, look at the last time it was done and
// suggest today's weight and reps. Work in a rep range (e.g. 6–8); once every
// working set reaches the top of the range, add weight and start again at the
// bottom. No program needed — only the exercise's own history.
import { EXERCISE_LIBRARY } from './exercises.js';
import { exerciseHistory, allExercises } from './stats.js';
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
  const rule = { ...defaultRule(name), ...custom, customRange: custom.min != null && custom.max != null && !custom.inferred, rangeLocked: !!custom.rangeLocked || (custom.min != null && custom.max != null) };
  if (custom.off === false && rule.kind === 'off') rule.kind = 'isolation';
  return { ...rule, label: rule.off ? KIND_LABEL.off : KIND_LABEL[rule.kind] };
}

const RANGE_PRESETS = {
  compound: [[3, 5], [4, 6], [6, 8], [8, 10], [10, 12], [12, 15]],
  isolation: [[6, 10], [8, 12], [10, 15], [12, 20], [15, 25]],
  bodyweight: [[3, 6], [6, 12], [10, 15], [12, 20], [15, 25]]
};

function median(xs) {
  const a = [...xs].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Reps the lifter usually does on the first working set (last 8 sessions).
function typicalReps(hist) {
  const firsts = hist.slice(-8).map(h => workingSets(h).sets[0]).filter(Boolean).map(s => s.reps);
  return firsts.length ? median(firsts) : null;
}

// The default range only fits if the lifter actually trains in it. Someone who
// squats 3×5 or benches 3×10 gets a range around their own reps instead
// (unless they set one themselves on the exercise screen).
function withInferredRange(rule, hist) {
  if (rule.off || rule.rangeLocked || hist.length < 2) return rule;
  const t = typicalReps(hist);
  if (t == null || (t >= rule.min && t <= rule.max)) return rule;
  const presets = RANGE_PRESETS[rule.kind === 'lower' || rule.kind === 'upper' ? 'compound' : rule.kind === 'bodyweight' ? 'bodyweight' : 'isolation'];
  let best = null;
  for (const [mn, mx] of presets) {
    if (t >= mn && t <= mx && (!best || t - mn < t - best[0])) best = [mn, mx];
  }
  if (!best) best = t < presets[0][0] ? presets[0] : presets[presets.length - 1];
  return { ...rule, min: best[0], max: best[1], inferred: true };
}

// The rule actually used for an exercise, including a range inferred from history.
export function effectiveRule(data, name) {
  return withInferredRange(ruleFor(data, name), exerciseHistory(data, name));
}

// Fix the inferred range once an exercise has a few sessions, so it reflects
// the lifter's own habit and doesn't drift with the app's own suggestions.
// Runs on load and when a workout is finished; returns true if anything changed.
const LOCK_AFTER = 3;
export function lockRanges(data) {
  let changed = false;
  for (const e of allExercises(data)) {
    const rule = ruleFor(data, e.name);
    if (rule.off || rule.rangeLocked) continue;
    const hist = exerciseHistory(data, e.name);
    if (hist.length < LOCK_AFTER) continue;
    const r = withInferredRange(rule, hist);
    setRule(data, e.name, r.inferred ? { min: r.min, max: r.max, inferred: true } : { rangeLocked: true });
    changed = true;
  }
  return changed;
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
  const base0 = ruleFor(data, name);
  if (base0.off) return null;
  const todayIso = isoDate(now);
  const hist = exerciseHistory(data, name).filter(h => h.dateISO <= todayIso);
  if (!hist.length) return null;
  const rule = withInferredRange(base0, hist);

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

function floorTo(x, step) { return Math.floor(x / step + 1e-9) * step; }

// Set-by-set plan following the order of the last session: working sets get
// the suggestion, warm-up and back-off sets keep their reps and move with the
// working weight.
function planFrom(session, top, workKg, targets) {
  let w = 0;
  return session.sets
    .map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }))
    .filter(s => s.reps > 0)
    .map(s => {
      if (s.kg === top) return { kg: workKg, reps: targets[Math.min(w++, targets.length - 1)], working: true };
      let kg = s.kg;
      if (top && kg && workKg !== top) kg = Math.min(workKg, Math.round(kg * workKg / top / 2.5) * 2.5) || s.kg;
      return { kg, reps: s.reps, working: false };
    });
}

function suggestFrom(data, hist, rule, now) {
  const session = hist[hist.length - 1];
  const last = workingSets(session);
  if (!last.sets.length) return null;
  const reps = last.sets.map(s => s.reps);
  const n = reps.length;
  const total = reps.reduce((a, b) => a + b, 0);
  const lastText = `${last.top ? fmt(last.top) + ' kg' : 'lastna teža'} × ${reps.join(', ')}`;
  const range = `${rule.min}–${rule.max}`;
  const kgLabel = kg => (kg ? fmt(kg) + ' kg' : 'lastna teža');
  const result = (type, kg, targets, title, reason) => {
    const plan = planFrom(session, last.top, kg, targets);
    return { type, kg, reps: targets, sets: n, plan, rule, title, reason, last: lastText };
  };

  // When the next weight step is big for this weight (light dumbbells, cables),
  // build more reps first so the jump doesn't crash the reps below the range.
  let topReps = rule.max, bridge = false;
  if (last.top > 0) {
    const next = last.top + rule.step;
    const need = Math.ceil(30 * ((next * (1 + (rule.min - 1) / 30)) / last.top - 1));
    if (need > rule.max) { topReps = Math.min(need, Math.round(rule.max * 1.6)); bridge = true; }
  }
  // All working sets at the top — allowing the last one to be a rep short.
  const atTop = reps.every(r => r >= topReps) || (n >= 3 && reps[0] >= topReps && total >= n * topReps - 1);
  const isBelow = rs => rs.length > 0 && (rs[0] < rule.min || rs.reduce((a, b) => a + b, 0) / rs.length < rule.min - 1);
  const below = isBelow(reps);

  // Two sessions in a row under the range at the same weight, without
  // improving → back off by about 10 % (always at least one step).
  if (below && hist.length >= 2 && last.top > 0) {
    const prev = workingSets(hist[hist.length - 2]);
    const prevTotal = prev.sets.reduce((a, s) => a + s.reps, 0);
    if (prev.top === last.top && isBelow(prev.sets.map(s => s.reps)) && total <= prevTotal) {
      let kg = floorTo(last.top * 0.9, rule.step);
      if (kg >= last.top) kg = last.top - rule.step;
      if (kg > 0) {
        return result('deload', kg, Array(n).fill(rule.max), `${fmt(kg)} kg × ${rule.max}`,
          `Dvakrat zapored pod ${rule.min} ponovitev pri ${fmt(last.top)} kg brez napredka — zmanjšaj na ${fmt(kg)} kg in gradi nazaj.`);
      }
    }
  }

  if (atTop) {
    const readiness = poorReadiness(data, now);
    if (readiness) {
      return result('hold', last.top, Array(n).fill(rule.max), `${kgLabel(last.top)} × ${rule.max}`,
        `Zadnjič na vrhu razpona ${range}, a danes ${readiness} — drži težo, dvigni naslednjič.`);
    }
    const kg = last.top + rule.step;
    return result('up', kg, Array(n).fill(rule.min), `${last.top ? '' : '+'}${fmt(kg)} kg${last.top ? '' : ' uteži'} × ${rule.min}–${rule.max}`,
      last.top
        ? `Zadnjič ${bridge ? `${topReps}+ ponovitev` : `na vrhu razpona ${range}`} — dodaj ${fmt(rule.step)} kg.`
        : `Zadnjič vse serije na ${rule.max}+ — čas je za dodatno utež (${fmt(rule.step)} kg).`);
  }

  const target = below ? reps.map(r => Math.max(rule.min, Math.min(topReps, r + 1))) : reps.map(r => Math.min(topReps, r + 1));
  const pctStep = last.top ? Math.round(rule.step / last.top * 100) : 0;
  return result('reps', last.top, target, `${kgLabel(last.top)} × ${target.join(', ')}`,
    below
      ? `Zadnjič pod ${rule.min} ponovitev — ista teža, cilj ${rule.min} v vsaki seriji.`
      : bridge
        ? `Naslednji korak (+${fmt(rule.step)} kg) je za to težo velik (+${pctStep} %) — najprej ponovitve do ${topReps}, potem dvigni.`
        : `Ista teža, dodaj ponovitev — ko so serije na ${rule.max}, dvigneš težo.`);
}
