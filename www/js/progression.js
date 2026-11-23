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
  // Strict double progression (opt-in per exercise): a fixed number of working sets.
  rule.dp = !!custom.dp && !rule.off;
  rule.sets = Math.min(8, Math.max(1, Number(custom.sets) || 3));
  return { ...rule, label: rule.off ? KIND_LABEL.off : rule.dp ? 'Double progression' : KIND_LABEL[rule.kind] };
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
  const recent = hist.slice(-8);
  let firsts = recent.map(h => progressionSets(h, { min: 5 }).sets[0]).filter(Boolean).map(s => s.reps);
  if (firsts.length < recent.length / 2) firsts = recent.map(h => workingSets(h).sets[0]).filter(Boolean).map(s => s.reps); // trains heavy singles/doubles
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

// Turn strict double progression on or off for an exercise. Turning it on
// fixes the current (possibly inferred) range so it doesn't drift.
export function setDp(data, name, on) {
  if (!on) { setRule(data, name, { dp: false }); return; }
  const r = effectiveRule(data, name);
  setRule(data, name, { dp: true, off: false, sets: r.sets || 3, min: r.min, max: r.max, inferred: false });
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

// Reps at or below this are heavy test sets (a single, double or triple) for
// someone who trains this exercise in a higher range.
function testRepCut(min) { return min >= 5 ? 3 : min >= 4 ? 2 : 0; }

// Working sets for progression: like workingSets, but heavy test sets (e.g. a
// 100 × 2 for someone who benches 80 × 8) don't count. A short set is a test
// only when it's heavier than the rest of the session — and, when last time's
// working weight (prevTop) is known, not that weight or one step above it,
// which is a working set that fell short (72,5 × 2 after 70 × 6).
// { top, sets, normal, tests }
export function progressionSets(session, rule, prevTop = 0) {
  const cut = testRepCut(rule ? rule.min : 0);
  const all = session.sets.map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })).filter(s => s.reps > 0);
  const short = s => s.reps <= cut && s.kg > 0;
  const restTop = Math.max(0, ...all.filter(s => !short(s)).map(s => s.kg));
  const isTest = s => short(s) && s.kg > restTop && !(prevTop > 0 && s.kg >= prevTop - 0.01 && s.kg <= prevTop * 1.075);
  const normal = all.filter(s => !isTest(s));
  const tests = all.filter(isTest);
  const top = Math.max(0, ...normal.map(s => s.kg));
  return { top, sets: normal.filter(s => s.kg === top), normal, tests };
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
// `override` lets a program prescribe its own double progression for an
// exercise (e.g. { sets: 3, min: 8, max: 12 }) without touching the user's setting.
export function recommend(data, name, now = new Date(), override = null) {
  const base0 = override ? { ...ruleFor(data, name), ...override, off: false, dp: true, rangeLocked: true } : ruleFor(data, name);
  if (base0.off) return null;
  const todayIso = isoDate(now);
  let hist = exerciseHistory(data, name).filter(h => h.dateISO <= todayIso);
  if (!hist.length) return null;
  let rule = withInferredRange(base0, hist);

  // A test day — only heavy singles/doubles, or a heavy test with nothing but
  // warm-ups/back-offs below the usual working weight — is skipped: the
  // suggestion comes from the last normal session. So is a one-off big jump
  // that landed under the range (80 × 8 → 95 × 4); doing the new weight a
  // second time makes it the working weight.
  const testDayNote = (session, prevSession) => {
    const prevTop = prevSession ? progressionSets(prevSession, rule).top : 0;
    const ps = progressionSets(session, rule, prevTop);
    const testTop = ps.tests.reduce((a, x) => Math.max(a, x.kg), 0);
    if (ps.tests.length && (!ps.normal.length || ps.top < testTop * 0.8 || (prevTop > 0 && ps.top < prevTop * 0.95))) {
      const t = ps.tests.reduce((a, x) => (x.kg > a.kg ? x : a));
      return `${fmt(t.kg)} kg × ${t.reps} je bil test (težka serija), zato predlog izhaja iz zadnjega normalnega treninga.`;
    }
    if (prevTop > 0 && ps.sets.length && ps.sets[0].reps < rule.min && ps.top > prevTop * 1.05 && ps.top > prevTop + 2 * rule.step) {
      return `${fmt(ps.top)} kg × ${ps.sets[0].reps} je bil velik skok od ${fmt(prevTop)} kg, zato predlog izhaja iz zadnjega normalnega treninga.`;
    }
    return null;
  };
  let testNote = null;
  while (hist.length > 1) {
    const note = testDayNote(hist[hist.length - 1], hist[hist.length - 2]);
    if (!note) break;
    if (!testNote) testNote = note;
    hist = hist.slice(0, -1);
  }
  const withNote = r => (r && testNote ? { ...r, note: r.note ? `${testNote} ${r.note}` : testNote } : r);

  // Nothing but a test day to go on (e.g. only 100 × 3 logged so far): pick a
  // weight that fits the rep range from the heavy sets.
  if (hist.length === 1 && testDayNote(hist[0], null)) {
    const ps = progressionSets(hist[hist.length - 1], rule);
    const t = ps.tests.reduce((a, x) => (x.kg * (1 + x.reps / 30) > a.kg * (1 + a.reps / 30) ? x : a));
    if (!t.kg) return null;
    const step = rule.step || 2.5;
    let kg = floorTo(t.kg * (1 + t.reps / 30) / (1 + (rule.min + 2) / 30), step);
    if (kg <= 0) kg = step;
    const n = rule.dp ? rule.sets : 3;
    const targets = Array(n).fill(rule.min);
    return {
      type: 'calib', kg, reps: targets, sets: n, rule, toGo: n * (rule.max - rule.min), nextKg: kg + step,
      plan: targets.map(r => ({ kg, reps: r, working: true })),
      title: rule.dp ? dpTitle(kg, targets) : `${fmt(kg)} kg × ${rule.min}–${rule.max}`,
      reason: `Zadnjič samo težke serije (${fmt(t.kg)} kg × ${t.reps}) — za razpon ${rule.min}–${rule.max} je primerna teža ${fmt(kg)} kg.`,
      last: `${fmt(t.kg)} kg × ${t.reps}`
    };
  }

  // A lighter-than-usual session (a bad day) shouldn't reset the baseline: when
  // the last working weight is at least 5 % under the session before it, suggest
  // from that earlier session. Two light sessions in a row are a new level
  // (cut, deload) and count as normal; so does a light session that was the
  // deload this function asked for.
  if (hist.length >= 2) {
    const last = hist[hist.length - 1], prev = hist[hist.length - 2];
    const pt = progressionSets(prev, rule).top, lt = progressionSets(last, rule, pt).top;
    const gapDays = Math.round((fromIso(last.dateISO) - fromIso(prev.dateISO)) / 86400000);
    if (lt > 0 && pt > 0 && lt < pt * 0.95 && gapDays <= 28) {
      const base = suggestFrom(data, hist.slice(0, -1), rule, now);
      if (base && base.type !== 'deload') {
        return withNote({ ...base, last: `${base.last} (${fmtDateShort(fromIso(prev.dateISO))})`,
          note: `Zadnji trening (${fmt(lt)} kg) je bil lažji, zato ga predlog ne upošteva.` });
      }
    }
  }
  const r = suggestFrom(data, hist, rule, now);
  if (r && !testNote) {
    const t = progressionSets(hist[hist.length - 1], rule, hist.length > 1 ? progressionSets(hist[hist.length - 2], rule).top : 0).tests;
    if (t.length) {
      const best = t.reduce((a, s) => (s.kg > a.kg ? s : a));
      return { ...r, note: `Težka serija ${fmt(best.kg)} kg × ${best.reps} ni štela kot delovna serija.` };
    }
  }
  return withNote(r);
}

function floorTo(x, step) { return Math.floor(x / step + 1e-9) * step; }

// Set-by-set plan following the order of the last session: working sets get
// the suggestion, warm-up and back-off sets keep their reps and move with the
// working weight.
function planFrom(session, top, workKg, targets, rule) {
  let w = 0;
  const cut = testRepCut(rule.min);
  return session.sets
    .map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }))
    .filter(s => s.reps > 0 && !(s.reps <= cut && s.kg > top)) // heavy test sets aren't repeated
    .map(s => {
      if (s.kg === top) return { kg: workKg, reps: targets[Math.min(w++, targets.length - 1)], working: true };
      let kg = s.kg;
      if (top && kg && workKg !== top) kg = Math.min(workKg, Math.round(kg * workKg / top / 2.5) * 2.5) || s.kg;
      return { kg, reps: s.reps, working: false };
    });
}

// "3 × 8 @ 82,5 kg", or "82,5 kg × 8, 8, 7" when the sets differ.
function dpTitle(kg, targets) {
  const w = kg ? `${fmt(kg)} kg` : 'lastna teža';
  return targets.every(t => t === targets[0]) ? `${targets.length} × ${targets[0]} @ ${w}` : `${w} × ${targets.join(', ')}`;
}

// Double progression plan: the warm-ups from last time, then exactly the
// prescribed working sets (no back-offs, no extra sets).
function dpPlan(session, top, workKg, targets, rule) {
  const base = planFrom(session, top, workKg, targets, rule);
  const firstWork = base.findIndex(p => p.working);
  const warm = firstWork > 0 ? base.slice(0, firstWork) : [];
  return [...warm, ...targets.map(r => ({ kg: workKg, reps: r, working: true }))];
}

function suggestFrom(data, hist, rule, now) {
  const session = hist[hist.length - 1];
  const topOf = i => (i >= 0 ? progressionSets(hist[i], rule).top : 0);
  const last = progressionSets(session, rule, topOf(hist.length - 2));
  if (!last.sets.length) return null;
  const lastReps = last.sets.map(s => s.reps);
  // Double progression works with a fixed number of sets: extra sets don't
  // count, missing ones mean the top of the range isn't reached yet.
  const n = rule.dp ? rule.sets : lastReps.length;
  const missing = Math.max(0, n - lastReps.length);
  const reps = rule.dp ? [...lastReps.slice(0, n), ...Array(missing).fill(lastReps[lastReps.length - 1])] : lastReps;
  const total = reps.reduce((a, b) => a + b, 0);
  const lastText = `${last.top ? fmt(last.top) + ' kg' : 'lastna teža'} × ${lastReps.join(', ')}`;
  const range = `${rule.min}–${rule.max}`;
  const kgLabel = kg => (kg ? fmt(kg) + ' kg' : 'lastna teža');
  const result = (type, kg, targets, title, reason) => {
    const plan = rule.dp ? dpPlan(session, last.top, kg, targets, rule) : planFrom(session, last.top, kg, targets, rule);
    // Reps still missing before the weight goes up (all sets at the top of the range).
    const toGo = type === 'up' || type === 'hold' ? 0 : Array.from({ length: n }, (_, i) => Math.max(0, topReps - (lastReps[i] || 0))).reduce((a, b) => a + b, 0);
    return { type, kg, reps: targets, sets: n, plan, rule, title, reason, last: lastText, toGo, nextKg: last.top + rule.step };
  };

  // When the next weight step is big for this weight (light dumbbells, cables),
  // build more reps first so the jump doesn't crash the reps below the range.
  let topReps = rule.max, bridge = false;
  if (last.top > 0 && !rule.dp) {
    const next = last.top + rule.step;
    const need = Math.ceil(30 * ((next * (1 + (rule.min - 1) / 30)) / last.top - 1));
    if (need > rule.max) { topReps = Math.min(need, Math.round(rule.max * 1.6)); bridge = true; }
  }
  // Double progression after a session far outside the range (100 × 3 when
  // the range is 6–8, or 60 × 15): pick the weight that fits the range.
  if (rule.dp && last.top > 0 && (lastReps[0] > rule.max + 2 || lastReps[0] < rule.min - 2)) {
    const best = Math.max(...last.sets.map(s => s.kg * (1 + s.reps / 30)));
    let kg = floorTo(best / (1 + (rule.min + 2) / 30), rule.step);
    if (kg <= 0) kg = rule.step;
    const targets = Array(n).fill(rule.min);
    return { ...result('calib', kg, targets, dpTitle(kg, targets), `Zadnjič ${lastText} — za razpon ${range} je primerna teža ${fmt(kg)} kg. Začni pri ${rule.min} ponovitvah.`), toGo: n * (rule.max - rule.min) };
  }

  // All working sets at the top — allowing the last one to be a rep short.
  const atTop = missing === 0 && (reps.every(r => r >= topReps) || (!rule.dp && n >= 3 && reps[0] >= topReps && total >= n * topReps - 1));
  const isBelow = rs => rs.length > 0 && (rs[0] < rule.min || rs.reduce((a, b) => a + b, 0) / rs.length < rule.min - 1);
  const below = isBelow(reps);

  // Two sessions in a row under the range at the same weight, without
  // improving → back off by about 10 % (always at least one step).
  if (below && hist.length >= 2 && last.top > 0) {
    const prev = progressionSets(hist[hist.length - 2], rule, topOf(hist.length - 3));
    const prevTotal = prev.sets.reduce((a, s) => a + s.reps, 0);
    if (prev.top === last.top && isBelow(prev.sets.map(s => s.reps)) && total <= prevTotal) {
      let kg = floorTo(last.top * 0.9, rule.step);
      if (kg >= last.top) kg = last.top - rule.step;
      if (kg > 0) {
        return result('deload', kg, Array(n).fill(rule.max), rule.dp ? dpTitle(kg, Array(n).fill(rule.max)) : `${fmt(kg)} kg × ${rule.max}`,
          `Dvakrat zapored pod ${rule.min} ponovitev pri ${fmt(last.top)} kg brez napredka — zmanjšaj na ${fmt(kg)} kg in gradi nazaj.`);
      }
    }
  }

  if (atTop) {
    const readiness = poorReadiness(data, now);
    if (readiness) {
      return result('hold', last.top, Array(n).fill(rule.max), rule.dp ? dpTitle(last.top, Array(n).fill(rule.max)) : `${kgLabel(last.top)} × ${rule.max}`,
        `Zadnjič na vrhu razpona ${range}, a danes ${readiness} — drži težo, dvigni naslednjič.`);
    }
    const kg = last.top + rule.step;
    return result('up', kg, Array(n).fill(rule.min), rule.dp ? dpTitle(kg, Array(n).fill(rule.min)) : `${last.top ? '' : '+'}${fmt(kg)} kg${last.top ? '' : ' uteži'} × ${rule.min}–${rule.max}`,
      last.top
        ? `Zadnjič ${bridge ? `${topReps}+ ponovitev` : `na vrhu razpona ${range}`} — dodaj ${fmt(rule.step)} kg.`
        : `Zadnjič vse serije na ${rule.max}+ — čas je za dodatno utež (${fmt(rule.step)} kg).`);
  }

  // Under the range: one more rep per set (not straight to the bottom of the range — 4 → 6 is a lot).
  const target = reps.map(r => Math.min(topReps, r + 1));
  const pctStep = last.top ? Math.round(rule.step / last.top * 100) : 0;
  if (rule.dp) {
    return result('reps', last.top, target, dpTitle(last.top, target),
      missing
        ? `Zadnjič ${lastReps.length} od ${n} serij — danes naredi vse ${n}.`
        : below
          ? `Zadnjič pod ${rule.min} ponovitev — ista teža, ena ponovitev več na serijo.`
          : `Ista teža. Ko narediš ${n} × ${rule.max}, dvigneš na ${fmt(last.top + rule.step)} kg.`);
  }
  return result('reps', last.top, target, `${kgLabel(last.top)} × ${target.join(', ')}`,
    below
      ? `Zadnjič pod ${rule.min} ponovitev — ista teža, ponovitev več na serijo, dokler ne prideš na ${rule.min}.`
      : bridge
        ? `Naslednji korak (+${fmt(rule.step)} kg) je za to težo velik (+${pctStep} %) — najprej ponovitve do ${topReps}, potem dvigni.`
        : `Ista teža, dodaj ponovitev — ko so serije na ${rule.max}, dvigneš težo.`);
}
