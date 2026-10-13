import { store } from '../state.js';
import { isoDate, fromIso, fmtDateShort, fmtNum, fmtNum1, escapeHtml, plural } from '../util.js';
import { buildReport, periodBounds, shiftPeriod, markReportSeen } from '../reports.js';
import { pct, hm } from '../analysis.js';

const LEVEL = {
  good: { color: 'var(--good)', icon: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>' },
  warn: { color: 'var(--mood)', icon: '<path d="M12 4 2.8 19.5h18.4z"></path><path d="M12 10v4M12 16.8h.01"></path>' },
  info: { color: 'var(--accentText)', icon: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 7.5h.01"></path>' }
};

function tile(label, value, sub, subColor) {
  return `<div style="background: var(--card); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow); min-width: 0">
<span style="font-size: 12px; color: var(--text2)">${label}</span>
<span style="font-size: 20px; font-weight: 700; letter-spacing: -0.01em">${value}</span>
${sub ? `<span style="font-size: 12px; font-weight: 600; color: ${subColor || 'var(--text2)'}">${sub}</span>` : ''}
</div>`;
}

function card(title, inner, extra = '') {
  return `<section style="background: var(--card); border-radius: 22px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; box-shadow: var(--shadow); ${extra}">
<h2 style="margin: 0 0 4px; font-size: 15px; font-weight: 600">${title}</h2>
${inner}
</section>`;
}

function rows(items, render) {
  return items.map((it, i) => `<div style="padding: 9px 0; ${i ? 'border-top: 1px solid var(--line);' : ''}">${render(it)}</div>`).join('');
}

function delta(cur, prev, fmt, goodWhenUp = true) {
  if (cur == null || prev == null) return { text: '', color: '' };
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return { text: 'enako kot prej', color: 'var(--text2)' };
  const good = goodWhenUp ? d > 0 : d < 0;
  return { text: `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} glede na prej`, color: good ? 'var(--good)' : 'var(--danger)' };
}

function template(r, kind) {
  const p = r.period;
  const unitNext = kind === 'month' ? 'naslednji mesec' : 'naslednji teden';
  const atCurrent = r.inProgress;
  const w = r.wellness, pw = r.prevWellness;
  const sleepD = delta(w.sleep, pw.sleep, v => `${Math.round(v)} min`);
  const stressD = delta(w.stress, pw.stress, v => fmtNum1(v), false);

  const navBtn = (action, label, path, disabled) => `<button type="button" data-action="${action}" aria-label="${label}" ${disabled ? 'disabled' : ''} style="width: 44px; height: 44px; border: 0; border-radius: 22px; background: var(--fill); color: ${disabled ? 'var(--text2)' : 'var(--accentText)'}; display: flex; align-items: center; justify-content: center; cursor: ${disabled ? 'default' : 'pointer'}; opacity: ${disabled ? 0.5 : 1}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>
</button>`;
  const seg = ['week', 'month'].map(k => {
    const on = k === kind;
    return `<button type="button" role="tab" aria-selected="${on}" data-action="kind" data-kind="${k}" style="height: 34px; border: 0; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--text2);'}">${k === 'week' ? 'Tedensko' : 'Mesečno'}</button>`;
  }).join('');

  const volSub = r.volumeChange == null ? '' : `${pct(r.volumeChange)} glede na prej`;
  const insightsHtml = r.insights.length ? rows(r.insights, it => {
    const st = LEVEL[it.level] || LEVEL.info;
    return `<div style="display: flex; gap: 10px; align-items: flex-start">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: ${st.color}; flex-shrink: 0; margin-top: 1px">${st.icon}</svg>
<span style="font-size: 14px">${escapeHtml(it.text)}</span>
</div>`;
  }) : '<div style="font-size: 14px; color: var(--text2); padding: 6px 0">V tem obdobju še ni podatkov.</div>';

  const recordsHtml = r.records.length ? card('Rekordi', rows(r.records, x => `<a href="#/vaja?name=${encodeURIComponent(x.name)}" style="display: flex; justify-content: space-between; gap: 8px; text-decoration: none; color: var(--text)">
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${escapeHtml(x.name)}</span><span style="font-size: 12px; color: var(--text2)">${fmtDateShort(fromIso(x.dateISO))} · ${x.was}</span></span>
<span style="font-size: 15px; font-weight: 700; color: var(--good); flex-shrink: 0">${x.text}</span>
</a>`)) : '';

  const progressHtml = r.progressed.length ? card('Napredek', rows(r.progressed, x => `<a href="#/vaja?name=${encodeURIComponent(x.name)}" style="display: flex; justify-content: space-between; gap: 8px; text-decoration: none; color: var(--text)">
<span style="font-size: 15px; font-weight: 600; min-width: 0">${escapeHtml(x.name)}</span>
<span style="font-size: 14px; color: var(--good); font-weight: 600; flex-shrink: 0">${x.text}</span>
</a>`)) : '';

  const plateauHtml = r.plateaus.length ? card('Platoji', rows(r.plateaus, x => `<a href="#/vaja?name=${encodeURIComponent(x.name)}" style="display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: var(--text)">
<span style="display: flex; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 600">${escapeHtml(x.name)}</span><span style="font-size: 13px; font-weight: 600; color: ${x.cut ? 'var(--accentText)' : 'var(--mood)'}; flex-shrink: 0">${x.weeks} ${x.weeks === 1 ? 'teden' : x.weeks === 2 ? 'tedna' : x.weeks <= 4 ? 'tedne' : 'tednov'}${x.cut ? ' · cut' : ''}</span></span>
<span style="font-size: 12px; color: var(--text2)">Najboljše: ${x.best} · ${x.tips[0] ? escapeHtml(x.tips[0].text) : ''}</span>
</a>`)) : '';

  const liftsHtml = r.mainLifts.length ? card('Glavni dvigi ta mesec', rows(r.mainLifts, x => `<a href="#/vaja?name=${encodeURIComponent(x.name)}" style="display: flex; justify-content: space-between; gap: 8px; text-decoration: none; color: var(--text)">
<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0"><span style="font-size: 15px; font-weight: 600">${escapeHtml(x.name)}</span><span style="font-size: 12px; color: var(--text2)">${plural(x.count, ['trening', 'treninga', 'treningi', 'treningov'])}</span></span>
<span style="font-size: 14px; font-weight: 600; flex-shrink: 0; color: ${x.change > 0 ? 'var(--good)' : 'var(--text2)'}">${String(x.first).replace('.', ',')} → ${String(x.best).replace('.', ',')} kg</span>
</a>`)) : '';

  return `
<header style="padding: 16px 12px 0 8px">
<a href="#/analitika" style="height: 44px; padding: 0 8px; display: inline-flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Analitika
</a>
</header>

<main style="padding: 4px 20px 24px; display: flex; flex-direction: column; gap: 14px">
<h1 style="margin: 0; font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em">Poročilo</h1>

<div role="tablist" aria-label="Vrsta poročila" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--fill); border-radius: 12px">${seg}</div>

<div style="display: flex; align-items: center; justify-content: space-between">
${navBtn('prev', 'Prejšnje obdobje', 'M15 5l-7 7 7 7', false)}
<div style="display: flex; flex-direction: column; align-items: center; gap: 2px">
<span style="font-size: 17px; font-weight: 700">${p.label}</span>
<span style="font-size: 12px; color: var(--text2)">${atCurrent ? 'v teku' : kind === 'month' ? 'mesečno poročilo' : 'tedensko poročilo'}</span>
</div>
${navBtn('next', 'Naslednje obdobje', 'M9 5l7 7-7 7', atCurrent)}
</div>

<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
${tile('Treningi', `${r.workouts}${r.goal ? ` <span style="font-size: 14px; font-weight: 500; color: var(--text2)">/ ${r.goal}</span>` : ''}`, r.minutes ? hm(r.minutes) : '')}
${tile('Volumen', `${fmtNum(r.volume)} <span style="font-size: 14px; font-weight: 500; color: var(--text2)">kg</span>`, volSub, r.volumeChange == null ? '' : r.volumeChange >= 0 ? 'var(--good)' : 'var(--danger)')}
${tile('Rekordi', r.records.length, r.progressed.length ? `napredek pri ${r.progressed.length}` : '')}
${tile('Forma', r.form == null ? '—' : pct(r.form), r.form == null ? 'premalo podatkov' : 'glede na običajno', r.form == null ? '' : r.form >= 0 ? 'var(--good)' : 'var(--danger)')}
</div>

${card('Povzetek', insightsHtml)}

<section style="background: var(--accentSoft); border-radius: 22px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accentText)">Fokus za ${unitNext}</span>
<span style="font-size: 15px; font-weight: 600; color: var(--text)">${escapeHtml(r.focus)}</span>
</section>

${recordsHtml}
${progressHtml}
${liftsHtml}
${plateauHtml}

${card('Počutje', `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 4px 0 6px">
${['Spanec', 'Stres', 'Teža', 'Vpisi'].map((label, i) => {
    const vals = [
      [w.sleep != null ? hm(w.sleep) : '—', sleepD],
      [w.stress != null ? `${fmtNum1(w.stress)}/10` : '—', stressD],
      [w.weightNow != null ? `${fmtNum1(w.weightNow)} kg` : '—', { text: w.weightChange != null ? `${w.weightChange > 0 ? '+' : w.weightChange < 0 ? '−' : ''}${fmtNum1(Math.abs(w.weightChange))} kg v obdobju` : '', color: 'var(--text2)' }],
      [`${w.logged}/${w.possible}`, { text: w.possible ? `${Math.round(w.logged / w.possible * 100)} % dni` : '', color: w.possible && w.logged / w.possible < 0.8 ? 'var(--danger)' : 'var(--text2)' }]
    ][i];
    return `<div style="background: var(--fill); border-radius: 14px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0">
<span style="font-size: 12px; color: var(--text2)">${label}</span>
<span style="font-size: 16px; font-weight: 700">${vals[0]}</span>
${vals[1].text ? `<span style="font-size: 11px; font-weight: 600; color: ${vals[1].color}">${vals[1].text}</span>` : ''}
</div>`;
  }).join('')}
</div>`)}
</main>`;
}

export function mount(root, ctx) {
  const kind0 = ctx.params.kind === 'month' ? 'month' : 'week';
  const p = ctx.params.date;
  const state = { kind: kind0, anchor: /^\d{4}-\d{2}-\d{2}$/.test(p || '') ? fromIso(p) : new Date() };

  function go(kind, anchor) {
    state.kind = kind;
    state.anchor = anchor;
    history.replaceState(null, '', `#/porocilo?kind=${kind}&date=${isoDate(periodBounds(kind, anchor).start)}`);
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const report = buildReport(store.data, state.kind, state.anchor);
    root.innerHTML = template(report, state.kind);
    root.querySelectorAll('[data-action="kind"]').forEach(b => b.addEventListener('click', () => go(b.dataset.kind, state.anchor)));
    root.querySelector('[data-action="prev"]').addEventListener('click', () => go(state.kind, shiftPeriod(state.kind, report.period.start, -1)));
    const next = root.querySelector('[data-action="next"]');
    if (!next.disabled) next.addEventListener('click', () => go(state.kind, shiftPeriod(state.kind, report.period.start, 1)));
    // Opening a finished period's report clears the "report ready" card on Domov.
    if (!report.inProgress && markReportSeen(store.data, report.period.key)) store.save();
  }

  render();
  return store.subscribe(render);
}
