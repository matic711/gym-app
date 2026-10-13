import { store } from '../state.js';
import { isoDate, fromIso, fmtNum1, escapeHtml, plural } from '../util.js';
import { buildReport, periodBounds, shiftPeriod, markReportSeen, reportText } from '../reports.js';
import { hm } from '../analysis.js';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

function chip(text, color) {
  return `<span style="padding: 6px 12px; border-radius: 999px; background: var(--card); box-shadow: var(--shadow); font-size: 13px; font-weight: 700; color: ${color || 'var(--text)'}; white-space: nowrap">${text}</span>`;
}

function template(r, kind) {
  const p = r.period;
  const w = r.wellness;
  const navBtn = (action, label, path, disabled) => `<button type="button" data-action="${action}" aria-label="${label}" ${disabled ? 'disabled' : ''} style="width: 44px; height: 44px; border: 0; border-radius: 22px; background: var(--fill); color: ${disabled ? 'var(--text2)' : 'var(--accentText)'}; display: flex; align-items: center; justify-content: center; cursor: ${disabled ? 'default' : 'pointer'}; opacity: ${disabled ? 0.5 : 1}">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>
</button>`;
  const seg = ['week', 'month'].map(k => {
    const on = k === kind;
    return `<button type="button" role="tab" aria-selected="${on}" data-action="kind" data-kind="${k}" style="height: 34px; border: 0; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; ${on ? 'background: var(--card); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.08);' : 'background: transparent; color: var(--text2);'}">${k === 'week' ? 'Tedensko' : 'Mesečno'}</button>`;
  }).join('');

  const chips = [
    chip(`${r.workouts}${r.goal ? `/${r.goal}` : ''} ${plural(r.workouts, ['trening', 'treninga', 'treningi', 'treningov']).replace(/^\d+ /, '')}`, r.goal && !r.inProgress ? (r.workouts >= r.goal ? 'var(--good)' : 'var(--danger)') : ''),
    r.records.length ? chip(`${plural(r.records.length, ['rekord', 'rekorda', 'rekordi', 'rekordov'])}`, 'var(--good)') : '',
    w.sleep != null ? chip(`spanec ${hm(w.sleep)}`, w.sleep < 7 * 60 ? 'var(--mood)' : '') : '',
    w.weightNow != null ? chip(`teža ${fmtNum1(w.weightNow)} kg`) : ''
  ].filter(Boolean).join('');

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
<span style="font-size: 12px; color: var(--text2)">${r.inProgress ? 'v teku' : kind === 'month' ? 'mesečno poročilo' : 'tedensko poročilo'}</span>
</div>
${navBtn('next', 'Naslednje obdobje', 'M9 5l7 7-7 7', r.inProgress)}
</div>

<div style="display: flex; flex-wrap: wrap; gap: 8px">${chips}</div>

<section style="background: var(--card); border-radius: 22px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow)">
<h2 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--accentText)">Na kratko</h2>
${r.summary.map(t => `<p style="margin: 0; font-size: 15px; line-height: 1.45">${escapeHtml(t)}</p>`).join('')}
</section>

<section style="background: var(--accentSoft); border-radius: 22px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accentText)">Fokus za ${kind === 'month' ? 'naslednji mesec' : 'naslednji teden'}</span>
<span style="font-size: 15px; font-weight: 600; color: var(--text)">${escapeHtml(r.focus)}</span>
</section>

<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<button type="button" data-action="share" style="height: 48px; border: 0; border-radius: 14px; background: var(--fill); color: var(--text); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"></path></svg>
Deli
</button>
<a href="#/analitika?range=${kind}" style="height: 48px; border-radius: 14px; background: var(--accent); color: var(--onAccent); text-decoration: none; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center">Podrobno ›</a>
</div>
<div id="share-status" style="font-size: 13px; color: var(--text2); text-align: center; min-height: 18px"></div>
</main>`;
}

async function shareReport(r, statusEl) {
  const text = reportText(r);
  try {
    if (Capacitor.isNativePlatform() || navigator.share) {
      await Share.share({ title: 'Gym poročilo', text, dialogTitle: 'Deli poročilo' });
      return;
    }
  } catch (e) { /* cancelled or unsupported — fall back to clipboard */ }
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = 'Poročilo je kopirano v odložišče.';
  } catch (e) {
    statusEl.textContent = 'Deljenje ni uspelo.';
  }
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
    root.querySelector('[data-action="share"]').addEventListener('click', () => shareReport(report, root.querySelector('#share-status')));
    // Opening a finished period's report clears the "report ready" card on Domov.
    if (!report.inProgress && markReportSeen(store.data, report.period.key)) store.save();
  }

  render();
  return store.subscribe(render);
}
