// Weekly and monthly reports, computed on the fly from the stored data, so any
// past week or month can be opened again.
import { isoDate, addDays, fromIso, startOfWeek, fmtDateShort, workoutVolume, MONTHS } from './util.js';
import { exerciseHistory, allExercises } from './stats.js';
import { workingSets } from './progression.js';
import { progressDates, detectPlateaus } from './plateau.js';
import { sessionPerformances, sleepMinutes } from './analysis.js';

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }

export function periodBounds(kind, anchor) {
  let start, end;
  if (kind === 'month') {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  } else {
    start = startOfWeek(anchor);
    end = addDays(start, 6);
  }
  const startIso = isoDate(start), endIso = isoDate(end);
  const label = kind === 'month'
    ? `${MONTHS[start.getMonth()].replace(/^./, c => c.toUpperCase())} ${start.getFullYear()}`
    : `${fmtDateShort(start)} – ${fmtDateShort(end)}`;
  const key = kind === 'month' ? `month:${startIso.slice(0, 7)}` : `week:${startIso}`;
  return { kind, start, end, startIso, endIso, label, key, days: Math.round((end - start) / 86400000) + 1 };
}

export function shiftPeriod(kind, anchor, dir) {
  return kind === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1) : addDays(anchor, 7 * dir);
}

function wellnessIn(data, fromIso_, toIso_) {
  return Object.entries(data.wellness).filter(([iso]) => iso >= fromIso_ && iso <= toIso_).sort(([a], [b]) => a.localeCompare(b));
}

function fmtKg(kg) { return Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ','); }

// New heaviest working weight (or more reps at the heaviest weight ever) in the period.
function recordsIn(data, p) {
  const out = [];
  for (const e of allExercises(data)) {
    let bestTop = 0, bestRepsAtTop = 0, seen = false;
    for (const h of exerciseHistory(data, e.name)) {
      const ws = workingSets(h);
      if (!ws.sets.length) continue;
      const reps = Math.max(...ws.sets.map(s => s.reps));
      if (h.dateISO >= p.startIso && h.dateISO <= p.endIso && seen && ws.top > 0) {
        if (ws.top > bestTop) out.push({ name: e.name, dateISO: h.dateISO, text: `${fmtKg(ws.top)} kg × ${reps}`, was: `prej ${fmtKg(bestTop)} kg`, kind: 'kg' });
        else if (ws.top === bestTop && reps > bestRepsAtTop) out.push({ name: e.name, dateISO: h.dateISO, text: `${fmtKg(ws.top)} kg × ${reps}`, was: `prej × ${bestRepsAtTop}`, kind: 'reps' });
      }
      if (h.dateISO > p.endIso) break;
      seen = true;
      if (ws.top > bestTop) { bestTop = ws.top; bestRepsAtTop = reps; } else if (ws.top === bestTop) bestRepsAtTop = Math.max(bestRepsAtTop, reps);
    }
  }
  // keep the best record per exercise
  const byName = new Map();
  for (const r of out) byName.set(r.name, r);
  return [...byName.values()].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

// Exercises that progressed in the period, with what changed vs. before it.
function progressIn(data, p) {
  const out = [];
  for (const e of allExercises(data)) {
    const hist = exerciseHistory(data, e.name).filter(h => h.dateISO <= p.endIso);
    const inP = hist.filter(h => h.dateISO >= p.startIso);
    if (!inP.length) continue;
    const before = hist.filter(h => h.dateISO < p.startIso);
    if (!before.length) continue;
    const dates = progressDates(hist).filter(d => d >= p.startIso);
    if (!dates.length) continue;
    const b = workingSets(before[before.length - 1]);
    const best = inP.map(workingSets).reduce((a, s) => (s.top > a.top || (s.top === a.top && Math.max(...s.sets.map(x => x.reps)) > Math.max(...a.sets.map(x => x.reps))) ? s : a));
    const text = best.top > b.top
      ? `${fmtKg(b.top)} → ${fmtKg(best.top)} kg`
      : `${fmtKg(best.top)} kg: ${b.sets.map(s => s.reps).join(', ')} → ${best.sets.map(s => s.reps).join(', ')}`;
    out.push({ name: e.name, text });
  }
  return out;
}

// Month only: heaviest working weight at the start of the month vs. the best in it.
function mainLifts(data, p) {
  const out = [];
  for (const e of allExercises(data)) {
    const inP = exerciseHistory(data, e.name).filter(h => h.dateISO >= p.startIso && h.dateISO <= p.endIso);
    if (inP.length < 2) continue;
    const first = workingSets(inP[0]).top, best = Math.max(...inP.map(h => workingSets(h).top));
    if (!best) continue;
    out.push({ name: e.name, count: inP.length, first, best, change: best - first });
  }
  return out.sort((a, b) => b.count - a.count || b.best - a.best).slice(0, 6);
}

function wellnessSummary(data, p, effectiveEndIso, todayIso) {
  const list = wellnessIn(data, p.startIso, effectiveEndIso).map(([iso, e]) => ({ iso, e }));
  const sleep = mean(list.map(x => sleepMinutes(x.e)).filter(v => v != null));
  const stress = mean(list.map(x => x.e.stress).filter(v => v != null));
  const energy = mean(list.map(x => x.e.energy).filter(v => v != null));
  const weights = list.map(x => x.e.weight).filter(Boolean);
  const k = Math.min(3, Math.floor(weights.length / 2));
  const weightChange = k ? mean(weights.slice(-k)) - mean(weights.slice(0, k)) : null;
  let possible = Math.round((fromIso(effectiveEndIso) - fromIso(p.startIso)) / 86400000) + 1;
  if (effectiveEndIso === todayIso && !data.wellness[todayIso]) possible--;
  return { logged: list.length, possible: Math.max(0, possible), sleep, stress, energy, weightChange, weightNow: weights.length ? weights[weights.length - 1] : null };
}

export function buildReport(data, kind, anchor, now = new Date()) {
  const p = periodBounds(kind, anchor);
  const prev = periodBounds(kind, shiftPeriod(kind, p.start, -1));
  const todayIso = isoDate(now);
  const inProgress = todayIso <= p.endIso;
  const effectiveEndIso = inProgress ? todayIso : p.endIso;

  const workouts = data.workouts.filter(w => w.dateISO >= p.startIso && w.dateISO <= p.endIso);
  // A period in progress is compared with the same number of days of the previous one.
  const elapsed = Math.round((fromIso(effectiveEndIso) - p.start) / 86400000);
  const prevCutIso = inProgress ? isoDate(addDays(prev.start, elapsed)) : prev.endIso;
  const prevWorkouts = data.workouts.filter(w => w.dateISO >= prev.startIso && w.dateISO <= prevCutIso);
  const goalWeek = data.settings.goalPerWeek || 0;
  const goal = kind === 'month' ? Math.round(goalWeek * p.days / 7) : goalWeek;
  const volume = workouts.reduce((s, w) => s + workoutVolume(w), 0);
  const prevVolume = prevWorkouts.reduce((s, w) => s + workoutVolume(w), 0);
  const minutes = workouts.reduce((s, w) => s + (Number(w.durationMin) || 0), 0);

  const perfs = sessionPerformances(data).filter(x => x.dateISO >= p.startIso && x.dateISO <= p.endIso);
  const form = perfs.length ? mean(perfs.map(x => x.perf)) : null;

  const records = recordsIn(data, p);
  const progressed = progressIn(data, p);
  const plateaus = detectPlateaus(data, inProgress ? now : addDays(p.end, 1));
  const well = wellnessSummary(data, p, effectiveEndIso, todayIso);
  const prevWell = wellnessSummary(data, prev, prevCutIso, todayIso);

  const insights = [];
  const unit = kind === 'month' ? 'mesec' : 'teden';
  if (goal) {
    if (workouts.length >= goal) insights.push({ level: 'good', text: `Cilj dosežen: ${workouts.length} od ${goal} treningov.` });
    else if (!inProgress) insights.push({ level: 'warn', text: `${workouts.length} od ${goal} treningov — cilj ni dosežen.` });
  }
  if (records.length) insights.push({ level: 'good', text: `${records.length === 1 ? 'Nov rekord' : `${records.length} novih rekordov`}: ${records.slice(0, 3).map(r => r.name).join(', ')}.` });
  if (progressed.length) insights.push({ level: 'good', text: `Napredek pri ${progressed.length} ${progressed.length === 1 ? 'vaji' : 'vajah'}.` });
  if (prevVolume && volume / prevVolume - 1 >= 0.1) insights.push({ level: 'good', text: `Volumen +${Math.round((volume / prevVolume - 1) * 100)} % glede na prejšnji ${unit}.` });
  if (!inProgress && prevVolume && volume / prevVolume - 1 <= -0.2) insights.push({ level: 'warn', text: `Volumen ${Math.round((volume / prevVolume - 1) * 100)} % glede na prejšnji ${unit}.` });
  if (form != null && form >= 0.02) insights.push({ level: 'good', text: `Forma na treningih povprečno +${Math.round(form * 100)} % nad običajno.` });
  if (form != null && form <= -0.03) insights.push({ level: 'warn', text: `Forma na treningih povprečno ${Math.round(form * 100)} % pod običajno.` });
  for (const pl of plateaus.slice(0, 3)) insights.push({ level: pl.cut ? 'info' : 'warn', text: `${pl.name} stoji ${pl.weeks} ${pl.weeks === 1 ? 'teden' : pl.weeks === 2 ? 'tedna' : pl.weeks <= 4 ? 'tedne' : 'tednov'}${pl.cut ? ' (med cutom)' : ''}.` });
  if (well.sleep != null && well.sleep < 7 * 60) insights.push({ level: 'warn', text: `Spanec povprečno ${Math.floor(well.sleep / 60)} h ${String(Math.round(well.sleep % 60)).padStart(2, '0')} min — pod 7 h.` });
  if (well.stress != null && well.stress >= 7) insights.push({ level: 'warn', text: `Stres povprečno ${String(Math.round(well.stress * 10) / 10).replace('.', ',')}/10.` });
  if (well.possible >= 5 && well.logged / well.possible < 0.8) insights.push({ level: 'warn', text: `Vpisanih ${well.logged} od ${well.possible} dni.` });

  // One thing to focus on next.
  let focus;
  const nextUnit = kind === 'month' ? 'mesec' : 'teden';
  const plateauToFix = plateaus.find(x => !x.cut && x.tips.length);
  if (goal && !inProgress && workouts.length < goal) focus = `${goal} treningov naslednji ${nextUnit} — začni že prvi dan.`;
  else if (well.sleep != null && well.sleep < 7 * 60) focus = 'Spanec: cilj 7 h ali več. To je najcenejši način za močnejše lifte.';
  else if (plateauToFix) focus = `${plateauToFix.name}: ${plateauToFix.tips[0].text}`;
  else if (well.possible >= 5 && well.logged / well.possible < 0.8) focus = 'Vpisuj vsako jutro — brez tega analiza ne vidi, kaj ti pomaga.';
  else focus = 'Nadaljuj tako. Drži se predlogov teže in poskusi dodati ponovitev, kjer še nisi na vrhu razpona.';

  return {
    period: p, inProgress, goal,
    workouts: workouts.length, prevWorkouts: prevWorkouts.length, minutes,
    volume, prevVolume, volumeChange: prevVolume ? volume / prevVolume - 1 : null,
    form, records, progressed, plateaus, mainLifts: kind === 'month' ? mainLifts(data, p) : [],
    wellness: well, prevWellness: prevWell, insights, focus
  };
}

// The report that just became ready and hasn't been opened yet, if any.
// Weekly: Sunday from 19:00 until Tuesday. Monthly: last day from 19:00 until the 3rd.
export function pendingReport(data, now = new Date()) {
  const seen = new Set((data.meta && data.meta.seenReports) || []);
  const t = data.settings.toggles || {};
  const hour = now.getHours();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const candidates = [];
  if (t.reportMonthly !== false) {
    if (now.getDate() === lastDay && hour >= 19) candidates.push(periodBounds('month', now));
    else if (now.getDate() <= 3) candidates.push(periodBounds('month', new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  }
  if (t.reportWeekly !== false) {
    const dow = (now.getDay() + 6) % 7;
    if (dow === 6 && hour >= 19) candidates.push(periodBounds('week', now));
    else if (dow <= 1) candidates.push(periodBounds('week', addDays(now, -7)));
  }
  const firstData = [...data.workouts.map(w => w.dateISO), ...Object.keys(data.wellness)].sort()[0];
  return candidates.find(p => !seen.has(p.key) && firstData && firstData <= p.endIso) || null;
}

export function markReportSeen(data, key) {
  data.meta = data.meta || {};
  const list = data.meta.seenReports || [];
  if (list.includes(key)) return false;
  data.meta.seenReports = [...list, key].slice(-30);
  return true;
}
