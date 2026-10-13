// Weekly and monthly reports, computed on the fly from the stored data, so any
// past week or month can be opened again.
import { isoDate, addDays, fromIso, startOfWeek, fmtDateShort, workoutVolume, plural, MONTHS } from './util.js';
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
export function recordsIn(data, p) {
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

  const report = {
    kind, period: p, inProgress, goal,
    workouts: workouts.length, prevWorkouts: prevWorkouts.length, minutes,
    volume, prevVolume, volumeChange: prevVolume ? volume / prevVolume - 1 : null,
    form, records, progressed, plateaus, mainLifts: kind === 'month' ? mainLifts(data, p) : [],
    wellness: well, prevWellness: prevWell, insights, focus,
    bestLift: heaviestLift(data, p), volumeRank: inProgress ? null : volumeRank(data, kind, p, volume)
  };
  report.summary = narrative(report);
  return report;
}

// Heaviest working set of the period (the exercise with the most weight on the bar).
function heaviestLift(data, p) {
  let best = null;
  for (const w of data.workouts) {
    if (w.dateISO < p.startIso || w.dateISO > p.endIso) continue;
    for (const ex of w.exercises) {
      const ws = workingSets(ex);
      if (ws.top && (!best || ws.top > best.kg)) best = { name: ex.name, kg: ws.top, reps: Math.max(...ws.sets.map(s => s.reps)) };
    }
  }
  return best;
}

// "Best week by volume in the last N weeks" (or months), for finished periods.
function volumeRank(data, kind, p, volume) {
  if (!volume) return null;
  const n = kind === 'month' ? 6 : 8;
  let anchor = p.start, count = 0, best = true;
  for (let i = 1; i < n; i++) {
    anchor = shiftPeriod(kind, anchor, -1);
    const q = periodBounds(kind, anchor);
    const v = data.workouts.filter(w => w.dateISO >= q.startIso && w.dateISO <= q.endIso).reduce((s, w) => s + workoutVolume(w), 0);
    if (!v) continue;
    count++;
    if (v >= volume) best = false;
  }
  return best && count >= 3 ? `Po volumnu je to tvoj najboljši ${kind === 'month' ? 'mesec' : 'teden'} v zadnjih ${count + 1} ${kind === 'month' ? 'mesecih' : 'tednih'}. 🔥` : null;
}

function kgStr(kg) { return Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ','); }
function hmStr(min) { return `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min`; }
function weeksStr(n) { return plural(n, ['teden', 'tedna', 'tedne', 'tednov']); }

// The report in a few plain sentences.
function narrative(r) {
  const month = r.kind === 'month';
  const s = [];
  const w = r.wellness, pw = r.prevWellness;
  if (!r.workouts) {
    s.push(r.inProgress ? `${month ? 'Ta mesec' : 'Ta teden'} še nimaš zabeleženega treninga.` : `V ${month ? 'tem mesecu' : 'tem tednu'} ni zabeleženih treningov.`);
  } else {
    const lead = r.inProgress ? (month ? 'Ta mesec si do zdaj opravil' : 'Ta teden si do zdaj opravil') : (month ? 'V tem mesecu si opravil' : 'V tem tednu si opravil');
    const count = r.goal ? `${r.workouts} od ${r.goal} načrtovanih treningov` : plural(r.workouts, ['trening', 'treninga', 'treninge', 'treningov']);
    s.push(`${lead} ${count}${r.minutes ? ` (skupaj ${hmStr(r.minutes)})` : ''}${!r.inProgress && r.goal && r.workouts >= r.goal ? ' — cilj dosežen.' : '.'}`);
    if (r.volumeRank) s.push(r.volumeRank);
    else if (r.volumeChange != null && Math.abs(r.volumeChange) >= 0.05) s.push(`Volumen je bil ${Math.round(Math.abs(r.volumeChange) * 100)} % ${r.volumeChange > 0 ? 'večji' : 'manjši'} kot ${month ? 'prejšnji mesec' : 'prejšnji teden'}${r.inProgress ? ' v istem času' : ''}.`);
  }
  if (r.records.length) {
    s.push(`${r.records.length === 1 ? 'Nov rekord' : `${r.records.length} novi rekordi`}: ${r.records.slice(0, 3).map(x => `${x.name} ${x.text}`).join(', ')}! 🎉`);
  } else if (r.bestLift) {
    s.push(`Najtežji dvig: ${r.bestLift.name} ${kgStr(r.bestLift.kg)} kg × ${r.bestLift.reps}.`);
  }
  if (r.progressed.length) {
    s.push(`Napredoval si pri ${r.progressed.length === 1 ? 'eni vaji' : `${r.progressed.length} vajah`}: ${r.progressed.slice(0, 3).map(x => `${x.name} (${x.text})`).join(', ')}.`);
  }
  if (month && !r.progressed.length && r.mainLifts.length) {
    const moved = r.mainLifts.filter(x => x.change > 0).slice(0, 3);
    if (moved.length) s.push(`Glavni dvigi v tem mesecu: ${moved.map(x => `${x.name} ${kgStr(x.first)} → ${kgStr(x.best)} kg`).join(', ')}.`);
  }
  const well = [];
  if (w.sleep != null) {
    const d = pw.sleep != null ? Math.round(w.sleep - pw.sleep) : null;
    well.push(`Spal si povprečno ${hmStr(w.sleep)}${d ? ` (${d > 0 ? '+' : '−'}${Math.abs(d)} min glede na prej)` : ''}`);
  }
  if (w.stress != null) well.push(`stres ${String(Math.round(w.stress * 10) / 10).replace('.', ',')}/10`);
  if (w.weightNow != null) well.push(`teža ${String(Math.round(w.weightNow * 10) / 10).replace('.', ',')} kg${w.weightChange ? ` (${w.weightChange > 0 ? '+' : '−'}${String(Math.round(Math.abs(w.weightChange) * 10) / 10).replace('.', ',')} kg)` : ''}`);
  if (well.length) {
    const text = well.join(', ');
    s.push(text.charAt(0).toUpperCase() + text.slice(1) + '.');
  }
  if (w.possible >= 3) s.push(w.logged >= w.possible ? 'Vpisal si vsak dan. 👏' : `Vpisanih je ${w.logged} od ${w.possible} dni.`);
  const stuck = r.plateaus.filter(x => !x.cut);
  if (stuck.length) {
    const names = stuck.slice(0, 2).map(x => x.name).join(' in ');
    s.push(`${names} ${stuck.length === 1 ? 'stoji' : 'stojita'} že ${weeksStr(stuck[0].weeks)}.`);
  }
  return s;
}

// Plain-text version for sharing.
export function reportText(r) {
  const title = `${r.kind === 'month' ? 'Mesečno' : 'Tedensko'} poročilo · ${r.period.label}`;
  return `${title}\n\n${r.summary.join(' ')}\n\nFokus: ${r.focus}`;
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
