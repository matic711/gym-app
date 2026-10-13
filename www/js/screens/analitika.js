import { store } from '../state.js';
import { isoDate, addDays, fromIso, fmtDateShort, workoutVolume, fmtNum, fmtNum1, escapeHtml } from '../util.js';
import { allExercises } from '../stats.js';
import { formReport } from '../analysis.js';
import { detectPlateaus } from '../plateau.js';

const RANGES = [
  { label: 'Teden', days: 7 },
  { label: 'Mesec', days: 30 },
  { label: '3 mes.', days: 90 },
  { label: 'Leto', days: 365 },
  { label: 'Vse', days: 'all' }
];

function resolveRangeDays(data, today, spec) {
  if (spec !== 'all') return spec;
  const dates = [...Object.keys(data.wellness), ...data.workouts.map(w => w.dateISO)];
  if (!dates.length) return 30;
  const earliest = dates.reduce((a, b) => (a < b ? a : b));
  return Math.max(7, Math.round((today - fromIso(earliest)) / 86400000) + 1);
}

function bucketAverages(getEntry, rangeDays, today, bucketCount) {
  const start = addDays(today, -(rangeDays - 1));
  const buckets = [];
  const spanMs = rangeDays * 86400000;
  for (let b = 0; b < bucketCount; b++) {
    const from = new Date(start.getTime() + Math.floor(spanMs * b / bucketCount));
    const to = new Date(start.getTime() + Math.floor(spanMs * (b + 1) / bucketCount));
    let sum = 0, n = 0;
    for (let d = new Date(from); d < to; d = addDays(d, 1)) {
      const v = getEntry(isoDate(d));
      if (v != null) { sum += v; n++; }
    }
    buckets.push(n ? sum / n : null);
  }
  // carry forward to fill gaps so the line/bars stay continuous
  let last = null;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] == null) buckets[i] = last;
    else last = buckets[i];
  }
  return buckets;
}

function linePath(values, w, h, pad) {
  const valid = values.map((v, i) => v == null ? null : { i, v }).filter(Boolean);
  if (!valid.length) return { line: '', area: '', min: 0, max: 0 };
  const min = Math.min(...valid.map(p => p.v));
  const max = Math.max(...valid.map(p => p.v));
  const range = max - min || 1;
  const n = values.length;
  const x = i => n > 1 ? (i / (n - 1)) * w : w / 2;
  const y = v => pad + (1 - (v - min) / range) * (h - pad * 2);
  const pts = valid.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  const area = `M${x(valid[0].i).toFixed(1)},${h} L` + pts.join(' L') + ` L${x(valid[valid.length - 1].i).toFixed(1)},${h} Z`;
  return { line, area, min, max };
}

function barsHtml(values, w, h, barColor, maxRef) {
  const n = values.length;
  const gap = n > 1 ? 2 : 0;
  const barW = (w - gap * (n - 1)) / n;
  const max = maxRef || Math.max(1, ...values.filter(v => v != null));
  return values.map((v, i) => {
    if (v == null) return '';
    const bh = Math.max(2, (v / max) * h);
    const x = i * (barW + gap);
    const y = h - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(3, barW / 2).toFixed(1)}" style="fill: ${barColor}"></rect>`;
  }).join('');
}

function computeViewModel(rangeIdx) {
  const data = store.data;
  const today = new Date();
  const rangeDays = resolveRangeDays(data, today, RANGES[rangeIdx].days);
  const bucketCount = Math.min(rangeDays, 30);
  const start = addDays(today, -(rangeDays - 1));

  const weightVals = bucketAverages(iso => { const e = data.wellness[iso]; return e ? e.weight : null; }, rangeDays, today, bucketCount);
  const wp = linePath(weightVals, 318, 110, 8);
  const validWeights = weightVals.filter(v => v != null);
  const weightNow = validWeights[validWeights.length - 1] ?? null;
  const weightDelta = validWeights.length > 1 ? validWeights[validWeights.length - 1] - validWeights[0] : 0;
  const weightLabels = wp.max ? [wp.max, (wp.max + wp.min) / 2, wp.min].map(v => fmtNum1(v)) : ['—', '—', '—'];

  const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
  const sleepVals = bucketAverages(iso => {
    const e = data.wellness[iso];
    if (!e) return null;
    let d = toMin(e.wake) - toMin(e.bed);
    if (d < 0) d += 1440;
    return d;
  }, rangeDays, today, bucketCount);
  const validSleep = sleepVals.filter(v => v != null);
  const sleepAvg = validSleep.length ? validSleep.reduce((a, b) => a + b, 0) / validSleep.length : 0;
  const sleepMax = validSleep.length ? Math.max(...validSleep) : 0;
  const sleepMin = validSleep.length ? Math.min(...validSleep) : 0;
  const qualityVals = [];
  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const e = data.wellness[isoDate(d)];
    if (e) qualityVals.push(e.quality);
  }
  const qualityAvg = qualityVals.length ? qualityVals.reduce((a, b) => a + b, 0) / qualityVals.length : 0;
  const sleepBars = barsHtml(sleepVals, 318, 100, 'var(--sleep)', 600);
  const goalLineY = 110 - (480 / 600) * 100;

  const moodVals = bucketAverages(iso => { const e = data.wellness[iso]; return e ? e.mood + 1 : null; }, rangeDays, today, bucketCount);
  const validMood = moodVals.filter(v => v != null);
  const moodAvg = validMood.length ? validMood.reduce((a, b) => a + b, 0) / validMood.length : 0;
  const energyVals = [];
  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const e = data.wellness[isoDate(d)];
    if (e) energyVals.push(e.energy);
  }
  const energyAvg = energyVals.length ? energyVals.reduce((a, b) => a + b, 0) / energyVals.length : 0;
  const moodBars = moodVals.map(v => v == null ? { style: 'flex-grow: 1;' } : { style: `flex-grow: 1; border-radius: 3px; background: var(--mood); height: ${(v * 14).toFixed(0)}px; opacity: ${(0.35 + v * 0.13).toFixed(2)};` });

  const weekBuckets = [];
  const curWeekStart = addDays(today, -((today.getDay() + 6) % 7));
  for (let i = 3; i >= 0; i--) {
    const wkStart = addDays(curWeekStart, -7 * i);
    const wkEnd = addDays(wkStart, 6);
    const vol = data.workouts.filter(w => w.dateISO >= isoDate(wkStart) && w.dateISO <= isoDate(wkEnd)).reduce((s, w) => s + workoutVolume(w), 0);
    weekBuckets.push({ v: vol, label: i === 0 ? 'ta teden' : `${fmtDateShort(wkStart)}` });
  }
  const maxVol = Math.max(1, ...weekBuckets.map(b => b.v));
  const weeks_ = weekBuckets.map((b, i) => ({
    v: (b.v / 1000).toFixed(1).replace('.', ',') + ' t', l: b.label,
    style: `width: 100%; border-radius: 10px; height: ${Math.round(b.v / maxVol * 90)}px; background: ${i === 3 ? 'var(--accentSoft)' : 'var(--good)'};`
  }));

  const trainingCountInRange = data.workouts.filter(w => w.dateISO >= isoDate(start) && w.dateISO <= isoDate(today)).length;
  const freq = (trainingCountInRange / rangeDays * 7).toFixed(1).replace('.', ',');

  const prMap = new Map();
  for (const w of data.workouts) {
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        const cur = prMap.get(ex.name);
        if (!cur || s.kg > cur.kg || (s.kg === cur.kg && s.reps > cur.reps)) {
          prMap.set(ex.name, { kg: s.kg, reps: s.reps, dateISO: w.dateISO });
        }
      }
    }
  }
  const prs = [...prMap.entries()].sort((a, b) => b[1].dateISO.localeCompare(a[1].dateISO)).slice(0, 3)
    .map(([name, r], i) => ({ name, date: fmtDateShort(fromIso(r.dateISO)), v: `${fmtNum(r.kg)} kg × ${r.reps}`, border: i ? 'border-top: 1px solid var(--line);' : '' }));

  return {
    weightNow, weightDelta, wp, weightLabels,
    sleepAvg, sleepMax, sleepMin, qualityAvg, sleepBars, goalLineY,
    moodAvg, energyAvg, moodBars,
    weeks: weeks_, trainingCountInRange, freq,
    prs,
    form: (() => {
      const rep = formReport(data, today);
      const top = rep.items.find(i => i.level !== 'info') || rep.items[0];
      return top ? { ...top, slacking: rep.slacking } : null;
    })(),
    exercises: (() => {
      const plateaus = new Map(detectPlateaus(data, today).map(x => [x.name.toLowerCase(), x]));
      return allExercises(data).map(e => ({
      plateau: plateaus.get(e.name.toLowerCase()) || null,
      name: e.name,
      meta: `${e.count}× · zadnjič ${fmtDateShort(fromIso(e.lastISO))}`,
      best: e.bestKg ? `${fmtNum1(e.bestKg).replace(/,0$/, '')} kg` : '—'
    }));
    })(),
    fromLabel: fmtDateShort(start), toLabel: fmtDateShort(today), midLabel: fmtDateShort(addDays(start, Math.round(rangeDays / 2)))
  };
}

const EX_PREVIEW = 6;

function exercisesHtml(vm, showAll) {
  if (!vm.exercises.length) return `<div style="padding: 16px 0; color: var(--text2); font-size: 14px">Še ni zabeleženih vaj.</div>`;
  const list = showAll ? vm.exercises : vm.exercises.slice(0, EX_PREVIEW);
  return list.map((e, i) => `
<a href="#/vaja?name=${encodeURIComponent(e.name)}" style="display: flex; align-items: center; gap: 12px; padding: 12px 0; text-decoration: none; color: var(--text); ${i ? 'border-top: 1px solid var(--line);' : ''}">
<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0">
<span style="font-size: 15px; font-weight: 600">${escapeHtml(e.name)}${e.plateau ? ` <span style="padding: 1px 7px; border-radius: 999px; background: var(--fill); color: ${e.plateau.cut ? 'var(--accentText)' : 'var(--mood)'}; font-size: 11px; font-weight: 700; vertical-align: 2px">plato ${e.plateau.weeks} t.</span>` : ''}</span>
<span style="font-size: 12px; color: var(--text2)">${e.meta}</span>
</div>
<div style="display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0">
<span style="font-size: 11px; color: var(--text2)">Rekord</span>
<span style="font-size: 15px; font-weight: 700">${e.best}</span>
</div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2); flex-shrink: 0"><path d="M9 6l6 6-6 6"></path></svg>
</a>`).join('') + (vm.exercises.length > EX_PREVIEW ? `
<button type="button" data-action="toggleExercises" style="height: 44px; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--accentText); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">${showAll ? 'Pokaži manj' : `Pokaži vse (${vm.exercises.length})`}</button>` : '');
}

function template(vm, rangeIdx, showAllEx) {
  const rangesHtml = RANGES.map((r, i) => {
    const on = i === rangeIdx;
    return `<button type="button" role="tab" aria-selected="${on}" data-action="range" data-i="${i}" style="height: 34px; border: 0; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--text2);'}">${r.label}</button>`;
  }).join('');

  const prsHtml = vm.prs.length ? vm.prs.map(r => `
<a href="#/vaja?name=${encodeURIComponent(r.name)}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; text-decoration: none; color: var(--text); ${r.border}">
<div style="display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 15px; font-weight: 600">${escapeHtml(r.name)}</span>
<span style="font-size: 12px; color: var(--text2)">${r.date}</span>
</div>
<span style="font-size: 16px; font-weight: 700">${r.v}</span>
</a>`).join('') : `<div style="padding: 16px 0; color: var(--text2); font-size: 14px">Še ni podatkov o rekordih.</div>`;

  const weeksHtml = vm.weeks.map(w => `
<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; justify-content: flex-end; height: 130px">
<span style="font-size: 12px; font-weight: 600">${w.v}</span>
<div style="${w.style}"></div>
<span style="font-size: 11px; color: var(--text2)">${w.l}</span>
</div>`).join('');

  const moodBarsHtml = vm.moodBars.map(m => `<div style="${m.style}"></div>`).join('');

  return `
<main style="padding: 28px 20px 0; display: flex; flex-direction: column; gap: 16px">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Analitika</h1>

<div role="tablist" aria-label="Obdobje" style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">
${rangesHtml}
</div>

${vm.form ? `
<a href="#/porocilo?kind=week" style="background: var(--card); border-radius: 22px; padding: 16px 18px; display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--text); box-shadow: var(--shadow)">
<div style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1; min-width: 0">
<div style="font-size: 15px; font-weight: 600; color: var(--accentText)">Poročila</div>
<div style="font-size: 13px; color: var(--text2)">Tedensko in mesečno: rekordi, napredek, platoji, fokus</div>
</div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2); flex-shrink: 0"><path d="M9 6l6 6-6 6"></path></svg>
</a>

<a href="#/forma" style="background: var(--card); border-radius: 22px; padding: 16px 18px; display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--text); box-shadow: var(--shadow)">
<div style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1; min-width: 0">
<div style="font-size: 15px; font-weight: 600; color: var(--accentText)">Forma in vplivi</div>
<div style="font-size: 15px; font-weight: 600; color: ${{ bad: 'var(--danger)', warn: 'var(--mood)', good: 'var(--good)', info: 'var(--text)' }[vm.form.level]}">${vm.form.title}</div>
<div style="font-size: 13px; color: var(--text2)">Kako spanec, stres in teža vplivajo na tvoje lifte</div>
</div>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--text2); flex-shrink: 0"><path d="M9 6l6 6-6 6"></path></svg>
</a>` : ''}

<section aria-labelledby="a-teza" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: flex-start; justify-content: space-between">
<div style="display: flex; flex-direction: column; gap: 4px">
<h2 id="a-teza" style="margin: 0; font-size: 15px; font-weight: 600; color: var(--accentText)">Teža</h2>
<div style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em">${vm.weightNow != null ? fmtNum1(vm.weightNow) : '—'} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">kg</span></div>
</div>
<div style="padding: 5px 10px; border-radius: 999px; background: var(--fill); font-size: 13px; font-weight: 600; color: ${vm.weightDelta <= 0 ? 'var(--good)' : 'var(--danger)'}">${vm.weightDelta <= 0 ? '' : '+'}${fmtNum1(vm.weightDelta)} kg</div>
</div>
<div style="display: flex; gap: 8px">
<svg width="286" height="110" viewBox="0 0 318 110" preserveAspectRatio="none" role="img" aria-label="Graf teže" style="flex-grow: 1; overflow: visible">
<defs>
<linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" style="stop-color: var(--accent); stop-opacity: 0.18"></stop>
<stop offset="1" style="stop-color: var(--accent); stop-opacity: 0"></stop>
</linearGradient>
</defs>
<path d="M0 33.1H318M0 64.4H318M0 95.7H318" style="stroke: var(--line)" stroke-width="1" fill="none"></path>
${vm.wp.area ? `<path d="${vm.wp.area}" fill="url(#wgrad)"></path>` : ''}
${vm.wp.line ? `<path d="${vm.wp.line}" fill="none" style="stroke: var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>` : ''}
</svg>
<div style="display: flex; flex-direction: column; justify-content: space-between; padding: 26px 0 8px; font-size: 11px; color: var(--text2); height: 110px; box-sizing: border-box">
<span>${vm.weightLabels[0]}</span><span>${vm.weightLabels[1]}</span><span>${vm.weightLabels[2]}</span>
</div>
</div>
<div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); padding-right: 24px">
<span>${vm.fromLabel}</span><span>${vm.midLabel}</span><span>${vm.toLabel}</span>
</div>
</section>

<section aria-labelledby="a-spanec" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: flex-start; justify-content: space-between">
<div style="display: flex; flex-direction: column; gap: 4px">
<h2 id="a-spanec" style="margin: 0; font-size: 15px; font-weight: 600; color: var(--sleep)">Spanec · povprečje</h2>
<div style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em">${Math.floor(vm.sleepAvg / 60)} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">h</span> ${Math.round(vm.sleepAvg % 60)} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">min</span></div>
</div>
<div style="font-size: 12px; color: var(--text2); display: flex; align-items: center; gap: 6px; padding-top: 4px">
<svg width="16" height="4" aria-hidden="true"><path d="M0 2H16" style="stroke: var(--text2)" stroke-width="1.5" stroke-dasharray="3 3"></path></svg>
cilj 8 h
</div>
</div>
<svg width="318" height="110" viewBox="0 0 318 110" role="img" aria-label="Spanec po dnevih" style="overflow: visible">
<g>${vm.sleepBars}</g>
<path d="M0 ${vm.goalLineY.toFixed(1)}H318" style="stroke: var(--text2)" stroke-width="1.5" stroke-dasharray="3 3" fill="none"></path>
</svg>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding-top: 4px; border-top: 1px solid var(--line)">
<div style="display: flex; flex-direction: column; gap: 2px; padding-top: 10px"><span style="font-size: 12px; color: var(--text2)">Najdlje</span><span style="font-size: 15px; font-weight: 600">${Math.floor(vm.sleepMax / 60)} h ${String(Math.round(vm.sleepMax % 60)).padStart(2, '0')} min</span></div>
<div style="display: flex; flex-direction: column; gap: 2px; padding-top: 10px"><span style="font-size: 12px; color: var(--text2)">Najmanj</span><span style="font-size: 15px; font-weight: 600">${Math.floor(vm.sleepMin / 60)} h ${String(Math.round(vm.sleepMin % 60)).padStart(2, '0')} min</span></div>
<div style="display: flex; flex-direction: column; gap: 2px; padding-top: 10px"><span style="font-size: 12px; color: var(--text2)">Kakovost</span><span style="font-size: 15px; font-weight: 600">${fmtNum1(vm.qualityAvg)} / 5</span></div>
</div>
</section>

<section aria-labelledby="a-pocutje" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: flex-start; justify-content: space-between">
<div style="display: flex; flex-direction: column; gap: 4px">
<h2 id="a-pocutje" style="margin: 0; font-size: 15px; font-weight: 600; color: var(--mood)">Počutje · povprečje</h2>
<div style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em">${fmtNum1(vm.moodAvg)} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">/ 5</span></div>
</div>
<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; padding-top: 4px">
<span style="font-size: 12px; color: var(--text2)">Energija</span>
<span style="font-size: 15px; font-weight: 600">${fmtNum1(vm.energyAvg)} / 10</span>
</div>
</div>
<div role="img" aria-label="Počutje po dnevih" style="height: 90px; display: flex; align-items: flex-end; gap: 4px">${moodBarsHtml}</div>
<div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text2)">
<span>${vm.fromLabel}</span><span>${vm.midLabel}</span><span>${vm.toLabel}</span>
</div>
</section>

<section aria-labelledby="a-trening" style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: flex-start; justify-content: space-between">
<div style="display: flex; flex-direction: column; gap: 4px">
<h2 id="a-trening" style="margin: 0; font-size: 15px; font-weight: 600; color: var(--good)">Trening · volumen na teden</h2>
<div style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em">${vm.trainingCountInRange} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">treningov</span></div>
</div>
<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; padding-top: 4px">
<span style="font-size: 12px; color: var(--text2)">Pogostost</span>
<span style="font-size: 15px; font-weight: 600">${vm.freq} / teden</span>
</div>
</div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; height: 130px">${weeksHtml}</div>
</section>

<section aria-labelledby="a-pr" style="background: var(--card); border-radius: 22px; padding: 18px 18px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<h2 id="a-pr" style="margin: 0 0 6px; font-size: 15px; font-weight: 600">Osebni rekordi</h2>
${prsHtml}
</section>

<section aria-labelledby="a-vaje" style="background: var(--card); border-radius: 22px; padding: 18px 18px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<h2 id="a-vaje" style="margin: 0 0 2px; font-size: 15px; font-weight: 600">Statistika po vajah</h2>
<div style="font-size: 13px; color: var(--text2); padding-bottom: 4px">Izberi vajo za grafe napredka</div>
${exercisesHtml(vm, showAllEx)}
</section>
</main>`;
}

export function mount(root, ctx) {
  let rangeIdx = 1, showAllEx = false;
  function render() {
    root.innerHTML = template(computeViewModel(rangeIdx), rangeIdx, showAllEx);
    root.querySelector('[data-action="toggleExercises"]')?.addEventListener('click', () => { showAllEx = !showAllEx; render(); });
    root.querySelectorAll('[data-action="range"]').forEach(btn => btn.addEventListener('click', () => {
      rangeIdx = Number(btn.getAttribute('data-i'));
      render();
    }));
  }
  render();
  return store.subscribe(render);
}
