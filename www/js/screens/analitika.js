import { store } from '../state.js';
import { isoDate, addDays, fromIso, startOfWeek, fmtDateShort, workoutVolume, fmtNum, fmtNum1, escapeHtml, plural, MONTHS, MONTHS_SHORT } from '../util.js';
import { allExercises, exerciseHistory } from '../stats.js';
import { formReport, exerciseSessions, sleepMinutes, hm } from '../analysis.js';
import { detectPlateaus } from '../plateau.js';
import { workingSets } from '../progression.js';
import { recordsIn } from '../reports.js';
import { lineChartHtml } from '../components/lineChart.js';

const RANGES = [
  { key: 'week', label: 'Teden' },
  { key: 'month', label: 'Mesec' },
  { key: '3m', label: '3 mes.' },
  { key: 'year', label: 'Leto' },
  { key: 'all', label: 'Vse' }
];
const MOOD_LABELS = ['Slabo', 'Meh', 'V redu', 'Dobro', 'Odlično'];
const DAY_MS = 86400000;

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function fmtKg(kg) { return Number.isInteger(kg) ? fmtNum(kg) : fmtNum1(kg); }
function daysBetween(a, b) { return Math.round((b - a) / DAY_MS); }
function capital(s) { return s.replace(/^./, c => c.toUpperCase()); }

// The selected period. "Teden" and "Mesec" are calendar periods (like the
// reports); the longer ranges end today. A period still in progress is
// compared with the same number of days of the previous one.
function periodFor(key, data, today) {
  let start, end, unit, prevStart = null, label;
  if (key === 'week') {
    start = startOfWeek(today); end = addDays(start, 6); unit = 'day'; prevStart = addDays(start, -7);
    label = `${fmtDateShort(start)} – ${fmtDateShort(end)}`;
  } else if (key === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1); end = new Date(today.getFullYear(), today.getMonth() + 1, 0); unit = 'day';
    prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    label = `${capital(MONTHS[start.getMonth()])} ${start.getFullYear()}`;
  } else if (key === '3m') {
    start = addDays(today, -90); end = today; unit = 'week'; prevStart = addDays(start, -91);
  } else if (key === 'year') {
    start = addDays(today, -364); end = today; unit = 'month'; prevStart = addDays(start, -365);
  } else {
    const first = [...Object.keys(data.wellness), ...data.workouts.map(w => w.dateISO)].sort()[0];
    start = first ? fromIso(first) : addDays(today, -29);
    end = today;
    const span = daysBetween(start, today);
    unit = span > 120 ? 'month' : span > 31 ? 'week' : 'day';
  }
  const dataEnd = end < today ? end : new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const elapsed = daysBetween(start, dataEnd);
  const prevEnd = prevStart ? addDays(prevStart, elapsed) : null;
  if (!label) label = `${fmtDateShort(start)} – ${fmtDateShort(dataEnd)}`;
  return {
    key, start, end, dataEnd, unit, label,
    startIso: isoDate(start), endIso: isoDate(end), dataEndIso: isoDate(dataEnd),
    prevStartIso: prevStart ? isoDate(prevStart) : null, prevEndIso: prevEnd ? isoDate(prevEnd) : null,
    days: elapsed + 1
  };
}

function bucketsFor(p) {
  const out = [];
  if (p.unit === 'day') {
    for (let d = new Date(p.start); d <= p.end; d = addDays(d, 1)) out.push({ from: isoDate(d), to: isoDate(d), label: fmtDateShort(d) });
  } else if (p.unit === 'week') {
    for (let d = startOfWeek(p.start); d <= p.dataEnd; d = addDays(d, 7)) out.push({ from: isoDate(d), to: isoDate(addDays(d, 6)), label: fmtDateShort(d) });
  } else {
    for (let d = new Date(p.start.getFullYear(), p.start.getMonth(), 1); d <= p.dataEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      out.push({ from: isoDate(d), to: isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)), label: `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
    }
  }
  // clip to the selected period
  return out.map(b => ({ ...b, from: b.from < p.startIso ? p.startIso : b.from, to: b.to > p.dataEndIso ? p.dataEndIso : b.to, future: b.from > p.dataEndIso }));
}

function wellnessValues(data, from, to, pick) {
  if (!from || !to) return [];
  return Object.entries(data.wellness).filter(([iso]) => iso >= from && iso <= to).map(([, e]) => pick(e)).filter(v => v != null && !Number.isNaN(v));
}

// ---- strength: each exercise's strength index relative to its own average
function strengthData(data, p) {
  const sessions = exerciseSessions(data);
  const abs = [], rel = [], points = [];
  for (const list of sessions.values()) {
    const inP = list.filter(s => s.dateISO >= p.startIso && s.dateISO <= p.dataEndIso);
    if (!inP.length) continue;
    const base = mean(inP.map(s => s.idx));
    for (const s of inP) points.push({ dateISO: s.dateISO, rel: s.idx / base });
    if (p.prevStartIso) {
      const inPrev = list.filter(s => s.dateISO >= p.prevStartIso && s.dateISO <= p.prevEndIso);
      if (inPrev.length) {
        abs.push(base / mean(inPrev.map(s => s.idx)) - 1);
        const r1 = mean(inP.filter(s => s.bw).map(s => s.idx / s.bw)), r0 = mean(inPrev.filter(s => s.bw).map(s => s.idx / s.bw));
        if (r1 && r0) rel.push(r1 / r0 - 1);
      }
    }
  }
  return { change: mean(abs), relChange: mean(rel), points };
}

function topLifts(data, p) {
  const out = [];
  for (const e of allExercises(data)) {
    const hist = exerciseHistory(data, e.name);
    const inP = hist.filter(h => h.dateISO >= p.startIso && h.dateISO <= p.dataEndIso);
    if (!inP.length) continue;
    const best = inP.map(workingSets).reduce((a, s) => (s.top > a.top ? s : a), { top: 0, sets: [] });
    if (!best.top) continue;
    const inPrev = p.prevStartIso ? hist.filter(h => h.dateISO >= p.prevStartIso && h.dateISO <= p.prevEndIso) : [];
    const prevTop = inPrev.length ? Math.max(...inPrev.map(h => workingSets(h).top)) : null;
    out.push({ name: e.name, count: inP.length, top: best.top, reps: Math.max(...best.sets.map(s => s.reps)), change: prevTop ? best.top - prevTop : null });
  }
  return out.sort((a, b) => b.count - a.count || b.top - a.top);
}

// ---- small render helpers
function deltaHtml(cur, prev, { fmt, goodWhenUp = true, unit = '' } = {}) {
  if (cur == null || prev == null) return '';
  const d = cur - prev;
  if (Math.abs(d) < 1e-6) return `<span style="font-size: 12px; font-weight: 600; color: var(--text2)">= kot prej</span>`;
  const good = goodWhenUp ? d > 0 : d < 0;
  return `<span style="font-size: 12px; font-weight: 600; color: ${good ? 'var(--good)' : 'var(--danger)'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${unit} glede na prej</span>`;
}
function pctDeltaHtml(change, goodWhenUp = true) {
  if (change == null) return '';
  return deltaHtml(change, 0, { fmt: v => `${fmtNum1(v * 100)} %`, goodWhenUp });
}

function barChartHtml(values, { min, max, color, labels, goal, goalLabel, yLabels, height = 110, yWidth = 34 }) {
  const W = 318, H = height, n = values.length;
  const gap = n > 20 ? 1.5 : n > 1 ? 3 : 0;
  const bw = (W - gap * (n - 1)) / n;
  const y = v => H - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * H;
  const bars = values.map((v, i) => {
    if (v == null || (v <= 0 && min === 0)) return '';
    const top = y(v), h = Math.max(2, H - top);
    return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, bw / 2).toFixed(1)}" style="fill: ${color}"></rect>`;
  }).join('');
  const goalLine = goal != null ? `<path d="M0 ${y(goal).toFixed(1)}H${W}" style="stroke: var(--text2)" stroke-width="1.5" stroke-dasharray="4 3" fill="none"></path>` : '';
  const mid = labels[Math.floor((n - 1) / 2)];
  return `<div style="display: flex; gap: 8px">
<svg width="286" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Graf" style="flex-grow: 1; overflow: visible">${bars}${goalLine}</svg>
<div style="display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: var(--text2); height: ${H}px; min-width: ${yWidth}px; text-align: right">${yLabels.map(l => `<span>${l}</span>`).join('')}</div>
</div>
<div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); padding-right: ${yWidth + 8}px"><span>${labels[0]}</span>${n > 2 ? `<span>${mid}</span>` : ''}${n > 1 ? `<span>${labels[n - 1]}</span>` : ''}</div>
${goalLabel ? `<div style="font-size: 11px; color: var(--text2); display: flex; align-items: center; gap: 6px"><svg width="16" height="4" aria-hidden="true"><path d="M0 2H16" style="stroke: var(--text2)" stroke-width="1.5" stroke-dasharray="3 3"></path></svg>${goalLabel}</div>` : ''}`;
}

function card(id, title, color, headline, right, body) {
  return `<section aria-labelledby="${id}" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px">
<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">
<h2 id="${id}" style="margin: 0; font-size: 15px; font-weight: 600; color: ${color}">${title}</h2>
${headline}
</div>
<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; padding-top: 2px">${right}</div>
</div>
${body}
</section>`;
}
const big = (v, unit) => `<div style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em">${v}${unit ? ` <span style="font-size: 15px; font-weight: 500; color: var(--text2)">${unit}</span>` : ''}</div>`;
const small = (label, v) => `<span style="font-size: 12px; color: var(--text2)">${label}</span><span style="font-size: 15px; font-weight: 600">${v}</span>`;

function computeViewModel(rangeKey) {
  const data = store.data;
  const today = new Date();
  const p = periodFor(rangeKey, data, today);
  const buckets = bucketsFor(p);
  const labels = buckets.map(b => b.label);
  const hasPrev = !!p.prevStartIso;

  // strength
  const strength = strengthData(data, p);
  const strengthPoints = buckets.map(b => {
    const vals = strength.points.filter(x => x.dateISO >= b.from && x.dateISO <= b.to).map(x => x.rel);
    return vals.length ? { v: mean(vals), label: b.label } : null;
  }).filter(Boolean);
  const firstRel = strengthPoints.length ? strengthPoints[0].v : 1;
  const strengthChart = strengthPoints.map(x => ({ v: (x.v / firstRel - 1) * 100, label: x.label }));

  // weight
  const weightOf = (from, to) => mean(wellnessValues(data, from, to, e => e.weight || null));
  const weightBuckets = buckets.map(b => (b.future ? null : weightOf(b.from, b.to)));
  const weightPoints = buckets.map((b, i) => weightBuckets[i] == null ? null : { v: weightBuckets[i], label: b.label }).filter(Boolean);
  const loggedWeights = Object.entries(data.wellness).filter(([iso, e]) => iso <= p.dataEndIso && e.weight).sort(([a], [b]) => a.localeCompare(b));
  const weightNow = loggedWeights.length ? loggedWeights[loggedWeights.length - 1][1].weight : null;

  // sleep
  const sleepVals = buckets.map(b => (b.future ? null : mean(wellnessValues(data, b.from, b.to, sleepMinutes))));
  const sleepAll = wellnessValues(data, p.startIso, p.dataEndIso, sleepMinutes);
  const sleepPrev = hasPrev ? mean(wellnessValues(data, p.prevStartIso, p.prevEndIso, sleepMinutes)) : null;
  const quality = mean(wellnessValues(data, p.startIso, p.dataEndIso, e => e.quality));
  const qualityPrev = hasPrev ? mean(wellnessValues(data, p.prevStartIso, p.prevEndIso, e => e.quality)) : null;

  // mood, energy, stress
  const moodVals = buckets.map(b => (b.future ? null : mean(wellnessValues(data, b.from, b.to, e => e.mood != null ? e.mood + 1 : null))));
  const avg = (pick, from, to) => mean(wellnessValues(data, from, to, pick));
  const mood = avg(e => e.mood != null ? e.mood + 1 : null, p.startIso, p.dataEndIso);
  const energy = avg(e => e.energy, p.startIso, p.dataEndIso), stress = avg(e => e.stress, p.startIso, p.dataEndIso);

  // training
  const inP = data.workouts.filter(w => w.dateISO >= p.startIso && w.dateISO <= p.dataEndIso);
  const inPrev = hasPrev ? data.workouts.filter(w => w.dateISO >= p.prevStartIso && w.dateISO <= p.prevEndIso) : [];
  const volBuckets = buckets.map(b => (b.future ? null : data.workouts.filter(w => w.dateISO >= b.from && w.dateISO <= b.to).reduce((s, w) => s + workoutVolume(w), 0)));
  const volume = inP.reduce((s, w) => s + workoutVolume(w), 0), volumePrev = inPrev.reduce((s, w) => s + workoutVolume(w), 0);

  // records, exercises
  const records = recordsIn(data, { startIso: p.startIso, endIso: p.dataEndIso });
  const plateaus = new Map(detectPlateaus(data, today).map(x => [x.name.toLowerCase(), x]));
  const lifts = topLifts(data, p);
  const liftByName = new Map(lifts.map(l => [l.name.toLowerCase(), l]));
  const exercises = allExercises(data).map(e => ({
    name: e.name, plateau: plateaus.get(e.name.toLowerCase()) || null, lift: liftByName.get(e.name.toLowerCase()) || null,
    meta: `${e.count}× · zadnjič ${fmtDateShort(fromIso(e.lastISO))}`,
    best: e.bestKg ? `${fmtKg(e.bestKg)} kg` : '—'
  })).sort((a, b) => Number(!!b.lift) - Number(!!a.lift));

  const form = formReport(data, today);
  const formTop = form.items.find(i => i.level !== 'info') || form.items[0];

  return {
    p, labels, hasPrev, strength, strengthChart, lifts: lifts.slice(0, 3),
    weightPoints, weightNow, weightChange: weightPoints.length > 1 ? weightPoints[weightPoints.length - 1].v - weightPoints[0].v : null,
    weightAvg: weightOf(p.startIso, p.dataEndIso), weightPrevAvg: hasPrev ? weightOf(p.prevStartIso, p.prevEndIso) : null,
    sleepVals, sleepAvg: mean(sleepAll), sleepPrev, sleepMax: sleepAll.length ? Math.max(...sleepAll) : null, sleepMin: sleepAll.length ? Math.min(...sleepAll) : null, quality, qualityPrev,
    moodVals, mood, moodPrev: hasPrev ? avg(e => e.mood != null ? e.mood + 1 : null, p.prevStartIso, p.prevEndIso) : null,
    energy, energyPrev: hasPrev ? avg(e => e.energy, p.prevStartIso, p.prevEndIso) : null,
    stress, stressPrev: hasPrev ? avg(e => e.stress, p.prevStartIso, p.prevEndIso) : null,
    count: inP.length, countPrev: hasPrev ? inPrev.length : null, perWeek: inP.length / Math.max(1, p.days) * 7,
    volBuckets, volume, volumePrev: hasPrev ? volumePrev : null,
    records, exercises, formTop
  };
}

const EX_PREVIEW = 6;

function template(vm, rangeKey, showAllEx) {
  const p = vm.p;
  const rangesHtml = RANGES.map(r => {
    const on = r.key === rangeKey;
    return `<button type="button" role="tab" aria-selected="${on}" data-action="range" data-key="${r.key}" style="height: 34px; border: 0; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--text2);'}">${r.label}</button>`;
  }).join('');
  const navTile = (href, title, sub, subColor) => `<a href="${href}" style="background: var(--card); border-radius: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: var(--text); box-shadow: var(--shadow); min-width: 0">
<span style="font-size: 14px; font-weight: 600; color: var(--accentText)">${title} ›</span>
<span style="font-size: 12px; font-weight: 600; color: ${subColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${sub}</span>
</a>`;
  const formColor = vm.formTop ? { bad: 'var(--danger)', warn: 'var(--mood)', good: 'var(--good)', info: 'var(--text2)' }[vm.formTop.level] : 'var(--text2)';
  const sleepLabel = m => `${Math.round(m / 60)} h`;
  const noData = '<div style="font-size: 14px; color: var(--text2); padding: 8px 0">V tem obdobju ni podatkov.</div>';

  // Moč
  const liftsHtml = vm.lifts.length ? vm.lifts.map((l, i) => `<a href="#/vaja?name=${encodeURIComponent(l.name)}" style="display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; text-decoration: none; color: var(--text); ${i ? 'border-top: 1px solid var(--line);' : ''}">
<span style="font-size: 14px; font-weight: 600; min-width: 0">${escapeHtml(l.name)}</span>
<span style="display: flex; gap: 8px; align-items: baseline; flex-shrink: 0"><span style="font-size: 14px; font-weight: 700">${fmtKg(l.top)} kg × ${l.reps}</span>${l.change ? `<span style="font-size: 12px; font-weight: 600; color: ${l.change > 0 ? 'var(--good)' : 'var(--danger)'}">${l.change > 0 ? '▲' : '▼'} ${fmtKg(Math.abs(l.change))} kg</span>` : ''}</span>
</a>`).join('') : '';
  const sVals = vm.strengthChart.map(x => x.v);
  const sSpread = sVals.length ? Math.max(...sVals) - Math.min(...sVals) : 0;
  const sFmt = v => `${v >= 0 ? '+' : '−'}${sSpread < 6 ? fmtNum1(Math.abs(v)) : Math.abs(Math.round(v))} %`;
  const strengthCard = card('a-moc', 'Moč', 'var(--accentText)',
    big(vm.strength.change == null ? '—' : `${vm.strength.change >= 0 ? '+' : '−'}${fmtNum1(Math.abs(vm.strength.change) * 100)}`, vm.strength.change == null ? '' : '%') +
    `<span style="font-size: 12px; color: var(--text2)">${vm.strength.change != null ? (vm.p.key === 'week' ? 'glede na prejšnji teden' : vm.p.key === 'month' ? 'glede na prejšnji mesec' : 'glede na prejšnje obdobje') : vm.hasPrev ? 'ni primerjave s prejšnjim obdobjem' : 'izberi krajše obdobje za primerjavo'}</span>`,
    vm.strength.relChange != null ? small('Glede na telesno težo', `${vm.strength.relChange >= 0 ? '+' : '−'}${fmtNum1(Math.abs(vm.strength.relChange) * 100)} %`) : '',
    (vm.strengthChart.length > 1 ? `<div style="font-size: 12px; color: var(--text2)">Moč po treningih glede na začetek obdobja</div>` + lineChartHtml(vm.strengthChart, { fmt: sFmt, height: 110 }) : vm.strengthChart.length ? '' : noData) +
    (liftsHtml ? `<div><div style="font-size: 12px; font-weight: 600; color: var(--text2); padding-bottom: 2px">Najtežji dvigi v obdobju</div>${liftsHtml}</div>` : ''));

  const weightCard = card('a-teza', 'Teža', 'var(--accentText)',
    big(vm.weightNow != null ? fmtNum1(vm.weightNow) : '—', 'kg'),
    `${vm.weightChange != null ? `<span style="padding: 4px 10px; border-radius: 999px; background: var(--fill); font-size: 13px; font-weight: 600; color: var(--text)">${vm.weightChange > 0 ? '+' : vm.weightChange < 0 ? '−' : ''}${fmtNum1(Math.abs(vm.weightChange))} kg v obdobju</span>` : ''}
`,
    vm.weightPoints.length > 1 ? lineChartHtml(vm.weightPoints, { fmt: v => fmtNum1(v), height: 110 }) : noData);

  const sleepCard = card('a-spanec', 'Spanec · povprečje', 'var(--sleep)',
    big(vm.sleepAvg != null ? hm(vm.sleepAvg).replace(' h ', ' h ').replace(' min', '') : '—', vm.sleepAvg != null ? 'min' : ''),
    deltaHtml(vm.sleepAvg, vm.sleepPrev, { fmt: v => `${Math.round(v)} min` }),
    (vm.sleepVals.some(v => v != null) ? barChartHtml(vm.sleepVals, { min: 240, max: 600, color: 'var(--sleep)', labels: vm.labels, goal: 420, goalLabel: 'cilj 7 h', yLabels: ['10 h', '7 h', '4 h'] }) : noData) +
    `<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 10px; border-top: 1px solid var(--line)">
<div style="display: flex; flex-direction: column; gap: 2px">${small('Najdlje', vm.sleepMax != null ? hm(vm.sleepMax) : '—')}</div>
<div style="display: flex; flex-direction: column; gap: 2px">${small('Najmanj', vm.sleepMin != null ? hm(vm.sleepMin) : '—')}</div>
<div style="display: flex; flex-direction: column; gap: 2px">${small('Kakovost', vm.quality != null ? `${fmtNum1(vm.quality)} / 5` : '—')}${deltaHtml(vm.quality, vm.qualityPrev, { fmt: v => fmtNum1(v) })}</div>
</div>`);

  const moodCard = card('a-pocutje', 'Počutje · povprečje', 'var(--mood)',
    big(vm.mood != null ? MOOD_LABELS[Math.round(vm.mood) - 1] : '—', vm.mood != null ? `${fmtNum1(vm.mood)}/5` : ''),
    deltaHtml(vm.mood, vm.moodPrev, { fmt: v => fmtNum1(v) }),
    (vm.moodVals.some(v => v != null) ? barChartHtml(vm.moodVals, { min: 0, max: 5, color: 'var(--mood)', labels: vm.labels, yLabels: ['Odlično', 'V redu', 'Slabo'], yWidth: 48 }) : noData) +
    `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding-top: 10px; border-top: 1px solid var(--line)">
<div style="display: flex; flex-direction: column; gap: 2px">${small('Energija', vm.energy != null ? `${fmtNum1(vm.energy)} / 10` : '—')}${deltaHtml(vm.energy, vm.energyPrev, { fmt: v => fmtNum1(v) })}</div>
<div style="display: flex; flex-direction: column; gap: 2px">${small('Stres', vm.stress != null ? `${fmtNum1(vm.stress)} / 10` : '—')}${deltaHtml(vm.stress, vm.stressPrev, { fmt: v => fmtNum1(v), goodWhenUp: false })}</div>
</div>`);

  const maxVol = Math.max(1, ...vm.volBuckets.filter(v => v != null));
  const trainingCard = card('a-trening', 'Trening', 'var(--good)',
    big(vm.count, plural(vm.count, ['trening', 'treninga', 'treningi', 'treningov']).replace(/^\d+ /, '')),
    `${small('Pogostost', `${fmtNum1(vm.perWeek)} / teden`)}${deltaHtml(vm.count, vm.countPrev, { fmt: v => plural(v, ['trening', 'treninga', 'treningi', 'treningov']) })}`,
    `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px"><span style="font-size: 12px; color: var(--text2)">Volumen ${p.unit === 'day' ? 'po dnevih' : p.unit === 'week' ? 'po tednih' : 'po mesecih'}</span><span style="font-size: 13px; font-weight: 700">${fmtNum(vm.volume)} kg</span></div>
${barChartHtml(vm.volBuckets, { min: 0, max: maxVol, color: 'var(--good)', labels: vm.labels, yLabels: [`${fmtNum1(maxVol / 1000)} t`, '', '0'] })}
${deltaHtml(vm.volume, vm.volumePrev, { fmt: v => `${fmtNum(v)}`, unit: ' kg' })}`);

  const recordsCard = `<section aria-labelledby="a-pr" style="background: var(--card); border-radius: 22px; padding: 18px 18px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<h2 id="a-pr" style="margin: 0 0 4px; font-size: 15px; font-weight: 600">Rekordi v obdobju</h2>
${vm.records.length ? vm.records.map((r, i) => `<a href="#/vaja?name=${encodeURIComponent(r.name)}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 0; text-decoration: none; color: var(--text); ${i ? 'border-top: 1px solid var(--line);' : ''}">
<div style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${escapeHtml(r.name)}</span><span style="font-size: 12px; color: var(--text2)">${fmtDateShort(fromIso(r.dateISO))} · ${r.was}</span></div>
<span style="font-size: 16px; font-weight: 700; color: var(--good); flex-shrink: 0">${r.text}</span>
</a>`).join('') : '<div style="padding: 10px 0 14px; color: var(--text2); font-size: 14px">V tem obdobju ni novih rekordov.</div>'}
</section>`;

  const exList = showAllEx ? vm.exercises : vm.exercises.slice(0, EX_PREVIEW);
  const exercisesCard = `<section aria-labelledby="a-vaje" style="background: var(--card); border-radius: 22px; padding: 18px 18px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<h2 id="a-vaje" style="margin: 0 0 2px; font-size: 15px; font-weight: 600">Statistika po vajah</h2>
<div style="font-size: 13px; color: var(--text2); padding-bottom: 4px">Izberi vajo za grafe napredka</div>
${exList.length ? exList.map((e, i) => `<a href="#/vaja?name=${encodeURIComponent(e.name)}" style="display: flex; align-items: center; gap: 12px; padding: 12px 0; text-decoration: none; color: var(--text); ${i ? 'border-top: 1px solid var(--line);' : ''}">
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0">
<span style="font-size: 15px; font-weight: 600">${escapeHtml(e.name)}${e.plateau ? ` <span style="padding: 1px 7px; border-radius: 999px; background: var(--fill); color: ${e.plateau.cut ? 'var(--accentText)' : 'var(--mood)'}; font-size: 11px; font-weight: 700; vertical-align: 2px">plato ${e.plateau.weeks} t.</span>` : ''}</span>
<span style="font-size: 12px; color: var(--text2)">${e.meta}${e.lift && e.lift.change ? ` · <span style="font-weight: 600; color: ${e.lift.change > 0 ? 'var(--good)' : 'var(--danger)'}">${e.lift.change > 0 ? '▲' : '▼'} ${fmtKg(Math.abs(e.lift.change))} kg</span>` : ''}</span>
</div>
<div style="display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0"><span style="font-size: 11px; color: var(--text2)">Rekord</span><span style="font-size: 15px; font-weight: 700">${e.best}</span></div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2); flex-shrink: 0"><path d="M9 6l6 6-6 6"></path></svg>
</a>`).join('') : '<div style="padding: 16px 0; color: var(--text2); font-size: 14px">Še ni zabeleženih vaj.</div>'}
${vm.exercises.length > EX_PREVIEW ? `<button type="button" data-action="toggleExercises" style="height: 44px; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--accentText); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">${showAllEx ? 'Pokaži manj' : `Pokaži vse (${vm.exercises.length})`}</button>` : ''}
</section>`;

  const reportKind = rangeKey === 'month' ? 'month' : 'week';
  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 14px">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Analitika</h1>

<div style="display: flex; flex-direction: column; gap: 6px">
<div role="tablist" aria-label="Obdobje" style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">${rangesHtml}</div>
<div style="font-size: 13px; color: var(--text2); text-align: center">${p.label}${vm.hasPrev ? ' · primerjava s prejšnjim obdobjem' : ''}</div>
</div>

<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
${navTile(`#/porocilo?kind=${reportKind}`, 'Poročilo', reportKind === 'month' ? 'Ta mesec na kratko' : 'Ta teden na kratko', 'var(--text2)')}
${navTile('#/forma', 'Forma', vm.formTop ? vm.formTop.title : 'Premalo podatkov', formColor)}
</div>

${strengthCard}
${trainingCard}
${recordsCard}
${weightCard}
${sleepCard}
${moodCard}
${exercisesCard}
</main>`;
}

export function mount(root, ctx) {
  let rangeKey = RANGES.some(r => r.key === ctx.params.range) ? ctx.params.range : 'month';
  let showAllEx = false;
  function render() {
    root.innerHTML = template(computeViewModel(rangeKey), rangeKey, showAllEx);
    root.querySelectorAll('[data-action="range"]').forEach(btn => btn.addEventListener('click', () => {
      rangeKey = btn.dataset.key;
      history.replaceState(null, '', `#/analitika?range=${rangeKey}`);
      render();
    }));
    root.querySelector('[data-action="toggleExercises"]')?.addEventListener('click', () => { showAllEx = !showAllEx; render(); });
  }
  render();
  return store.subscribe(render);
}
