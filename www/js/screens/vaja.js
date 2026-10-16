import { store } from '../state.js';
import { fromIso, fmtDate, fmtDateShort, fmtNum, fmtNum1, escapeHtml } from '../util.js';
import { exerciseHistory } from '../stats.js';
import { lineChartHtml } from '../components/lineChart.js';
import { recommend, ruleFor, effectiveRule, setRule } from '../progression.js';
import { plateauFor } from '../plateau.js';

function progressionHtml(name) {
  const rule = effectiveRule(store.data, name);
  const rec = rule.off ? null : recommend(store.data, name);
  const step = String(rule.step).replace('.', ',');
  const btn = (action, label) => `<button type="button" data-action="${action}" style="height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--fill); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer">${label}</button>`;
  return `<section style="background: var(--card); border-radius: 22px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow)">
<div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px">
<h2 style="margin: 0; font-size: 15px; font-weight: 600">Napredovanje</h2>
<span style="font-size: 12px; color: var(--text2)">${rule.label}</span>
</div>
${rule.off
    ? '<div style="font-size: 14px; color: var(--text2)">Predlogi za to vajo so izklopljeni.</div>'
    : `<div style="font-size: 14px">Double progression: ${rule.min}–${rule.max} ponovitev, nato +${step} kg.${rule.inferred ? ' <span style="color: var(--text2)">Razpon je določen iz tvojih treningov.</span>' : ''}</div>
${rec ? `<div style="background: var(--fill); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 12px; color: var(--text2)">Naslednjič</span>
<span style="font-size: 16px; font-weight: 700">${rec.title}</span>
<span style="font-size: 12px; color: var(--text2)">${rec.reason}</span>
${rec.note ? `<span style="font-size: 12px; color: var(--mood)">${rec.note}</span>` : ''}
</div>` : '<div style="font-size: 13px; color: var(--text2)">Predlog se pokaže, ko vajo prvič zabeležiš.</div>'}`}
<div style="display: flex; gap: 8px; flex-wrap: wrap">
${rule.off ? '' : btn('editRange', `Razpon ${rule.min}–${rule.max}`) + btn('editStep', `Korak ${step} kg`)}
${btn('toggleProgression', rule.off ? 'Vklopi predloge' : 'Izklopi')}
</div>
</section>`;
}

const METRICS = [
  { key: 'topKg', label: 'Teža', unit: 'kg', fmt: v => fmtNum1(v), color: 'var(--accent)', title: 'Najtežji dvig' },
  { key: 'volume', label: 'Volumen', unit: 'kg', fmt: v => fmtNum(v), color: 'var(--sleep)', title: 'Volumen na trening' },
  { key: 'totalReps', label: 'Pon.', unit: 'pon.', fmt: v => fmtNum(v), color: 'var(--mood)', title: 'Ponovitve na trening' }
];

const RANGES = [
  { label: '3 mes.', days: 90 },
  { label: 'Leto', days: 365 },
  { label: 'Vse', days: null }
];

function fmtKg(kg) {
  return Number.isInteger(kg) ? fmtNum(kg) : fmtNum1(kg);
}

function computeViewModel(name, metricIdx, rangeIdx) {
  const all = exerciseHistory(store.data, name);
  const days = RANGES[rangeIdx].days;
  const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
  const hist = cutoff ? all.filter(h => fromIso(h.dateISO) >= cutoff) : all;
  const metric = METRICS[metricIdx];

  const points = hist.map(h => ({ v: h[metric.key], label: fmtDateShort(fromIso(h.dateISO)) }));
  const first = hist[0], last = hist[hist.length - 1];
  const delta = hist.length > 1 ? last[metric.key] - first[metric.key] : null;

  let pr = null;
  for (const h of all) {
    if (!pr || h.topKg > pr.kg || (h.topKg === pr.kg && h.topReps > pr.reps)) pr = { kg: h.topKg, reps: h.topReps, dateISO: h.dateISO };
  }
  const gain = all.length > 1 ? all[all.length - 1].topKg - all[0].topKg : null;

  const sessions = [...all].reverse().map((h, i) => ({
    workoutId: h.workoutId,
    date: fmtDate(fromIso(h.dateISO)),
    workoutName: h.workoutName,
    sets: h.sets.map(s => `${fmtKg(Number(s.kg) || 0)}×${s.reps}`).join(' · '),
    top: `${fmtKg(h.topKg)} × ${h.topReps}`,
    isPr: pr && h.dateISO === pr.dateISO && h.topKg === pr.kg,
    border: i ? 'border-top: 1px solid var(--line);' : ''
  }));

  return {
    name,
    muscle: all.length ? all[all.length - 1].muscle : '',
    count: all.length,
    lastLabel: all.length ? fmtDate(fromIso(all[all.length - 1].dateISO)) : '—',
    prLabel: pr ? `${fmtKg(pr.kg)} kg × ${pr.reps}` : '—',
    gain: gain == null ? '—' : `${gain >= 0 ? '+' : '−'}${fmtKg(Math.abs(gain))} kg`,
    metric, points,
    current: last ? metric.fmt(last[metric.key]) : '—',
    delta: delta == null ? null : { text: `${delta >= 0 ? '+' : '−'}${metric.fmt(Math.abs(delta))} ${metric.unit}`, good: delta >= 0 },
    sessions
  };
}

function segHtml(items, current, action) {
  return items.map((it, i) => {
    const on = i === current;
    return `<button type="button" role="tab" aria-selected="${on}" data-action="${action}" data-i="${i}" style="height: 34px; border: 0; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--text2);'}">${it.label}</button>`;
  }).join('');
}

function tile(label, value) {
  return `<div style="background: var(--card); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow)">
<div style="font-size: 12px; color: var(--text2)">${label}</div>
<div style="font-size: 17px; font-weight: 700">${value}</div>
</div>`;
}

function template(vm, metricIdx, rangeIdx) {
  const sessionsHtml = vm.sessions.length ? vm.sessions.map(s => `
<a href="#/uredi?id=${encodeURIComponent(s.workoutId)}" style="display: flex; align-items: center; gap: 12px; padding: 12px 0; text-decoration: none; color: var(--text); ${s.border}">
<div style="display: flex; flex-direction: column; gap: 3px; flex-grow: 1; min-width: 0">
<div style="display: flex; align-items: center; gap: 8px">
<span style="font-size: 15px; font-weight: 600">${s.date}</span>
${s.isPr ? '<span style="padding: 2px 8px; border-radius: 999px; background: var(--accentSoft); color: var(--accentText); font-size: 11px; font-weight: 700">REKORD</span>' : ''}
</div>
<div style="font-size: 13px; color: var(--text2)">${escapeHtml(s.workoutName)}</div>
<div style="font-size: 13px; color: var(--text); overflow-wrap: anywhere">${s.sets}</div>
</div>
<div style="display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0">
<span style="font-size: 11px; color: var(--text2)">Najtežje</span>
<span style="font-size: 15px; font-weight: 700">${s.top}</span>
</div>
</a>`).join('') : `<div style="padding: 16px 0; color: var(--text2); font-size: 14px">Ta vaja še ni bila zabeležena.</div>`;

  return `
<header style="padding: 16px 12px 0 8px">
<a href="#" data-action="back" style="height: 44px; padding: 0 8px; display: inline-flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Nazaj
</a>
</header>

<main style="padding: 4px 20px 24px; display: flex; flex-direction: column; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px">
<h1 style="margin: 0; font-size: 30px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em">${escapeHtml(vm.name)}</h1>
${vm.muscle ? `<div style="font-size: 14px; color: var(--text2)">${escapeHtml(vm.muscle)}</div>` : ''}
</div>

<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
${tile('Rekord', vm.prLabel)}
${tile('Od začetka', vm.gain)}
${tile('Treningov', vm.count)}
${tile('Zadnjič', vm.lastLabel)}
</div>

<section style="background: var(--card); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow)">
<div role="tablist" aria-label="Meritev" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">
${segHtml(METRICS, metricIdx, 'metric')}
</div>
<div style="display: flex; align-items: flex-start; justify-content: space-between">
<div style="display: flex; flex-direction: column; gap: 4px">
<h2 style="margin: 0; font-size: 15px; font-weight: 600; color: ${vm.metric.color}">${vm.metric.title}</h2>
<div style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em">${vm.current} <span style="font-size: 15px; font-weight: 500; color: var(--text2)">${vm.metric.unit}</span></div>
</div>
${vm.delta ? `<div style="padding: 5px 10px; border-radius: 999px; background: var(--fill); font-size: 13px; font-weight: 600; color: ${vm.delta.good ? 'var(--good)' : 'var(--danger)'}">${vm.delta.text}</div>` : ''}
</div>
${lineChartHtml(vm.points, { color: vm.metric.color, fmt: vm.metric.fmt })}
<div role="tablist" aria-label="Obdobje" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">
${segHtml(RANGES, rangeIdx, 'range')}
</div>
</section>

${(() => {
  const pl = plateauFor(store.data, vm.name);
  if (!pl) return '';
  const color = pl.cut ? 'var(--accentText)' : pl.long ? 'var(--danger)' : 'var(--mood)';
  return `<section style="background: var(--card); border-radius: 22px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow); border-left: 4px solid ${color}">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px">
<h2 style="margin: 0; font-size: 15px; font-weight: 600; color: ${color}">${pl.cut ? 'Moč drži med cutom' : pl.long ? 'Dolgotrajen plato' : 'Plato'}</h2>
<span style="font-size: 12px; color: var(--text2)">${pl.weeks} ${pl.weeks === 1 ? 'teden' : pl.weeks === 2 ? 'tedna' : pl.weeks <= 4 ? 'tedne' : 'tednov'} · ${pl.sessions} treningov</span>
</div>
<div style="font-size: 14px">Najboljše: ${pl.best}, od takrat brez napredka.</div>
<div style="font-size: 13px; font-weight: 600; color: var(--text2); padding-top: 2px">${pl.cut ? '' : 'Kaj poskusiti'}</div>
<ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 14px">
${pl.tips.map(t => `<li>${escapeHtml(t.text)}</li>`).join('')}
</ul>
</section>`;
})()}

${progressionHtml(vm.name)}

<section style="background: var(--card); border-radius: 22px; padding: 10px 18px 6px; display: flex; flex-direction: column; box-shadow: var(--shadow)">
<h2 style="margin: 6px 0 2px; font-size: 15px; font-weight: 600">Zgodovina</h2>
${sessionsHtml}
</section>
</main>`;
}

export function mount(root, ctx) {
  const name = ctx.params.name || '';
  let metricIdx = 0, rangeIdx = 2;
  function render() {
    root.innerHTML = template(computeViewModel(name, metricIdx, rangeIdx), metricIdx, rangeIdx);
    root.querySelector('[data-action="back"]').addEventListener('click', (e) => {
      e.preventDefault();
      if (history.length > 1) history.back(); else ctx.navigate('analitika');
    });
    root.querySelectorAll('[data-action="metric"]').forEach(b => b.addEventListener('click', () => { metricIdx = Number(b.dataset.i); render(); }));
    root.querySelectorAll('[data-action="range"]').forEach(b => b.addEventListener('click', () => { rangeIdx = Number(b.dataset.i); render(); }));
    root.querySelector('[data-action="editRange"]')?.addEventListener('click', () => {
      const r = effectiveRule(store.data, name);
      const val = prompt('Razpon ponovitev (npr. 6-8):', `${r.min}-${r.max}`);
      const m = /^\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*$/.exec(val || '');
      if (m && Number(m[1]) >= 1 && Number(m[2]) > Number(m[1])) { setRule(store.data, name, { min: Number(m[1]), max: Number(m[2]), inferred: false }); store.save(); }
    });
    root.querySelector('[data-action="editStep"]')?.addEventListener('click', () => {
      const r = ruleFor(store.data, name);
      const val = prompt('Korak teže v kg (npr. 2,5):', String(r.step).replace('.', ','));
      const num = parseFloat(String(val || '').replace(',', '.'));
      if (num > 0 && num <= 50) { setRule(store.data, name, { step: num }); store.save(); }
    });
    root.querySelector('[data-action="toggleProgression"]').addEventListener('click', () => {
      setRule(store.data, name, { off: !ruleFor(store.data, name).off });
      store.save();
    });
  }
  render();
  return store.subscribe(render);
}
