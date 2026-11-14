import { store, uid } from '../state.js';
import { fromIso, fmtDate, fmtDateShort, escapeHtml } from '../util.js';
import { lineChartHtml } from '../components/lineChart.js';
import {
  PROGRAMS, PER_WEEK, BENCH, programByKey, experimentOf, nextSession, sessionPlan, doneSessions,
  computeResult, resultText, startProgram, stopProgram, suggestedNext, fmtKg, repsTestKg
} from '../experiment.js';

const card = inner => `<section style="background: var(--card); border-radius: 22px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">${inner}</section>`;
const h2 = t => `<h2 style="margin: 0; font-size: 15px; font-weight: 600">${t}</h2>`;
const small = (t, color = 'var(--text2)') => `<div style="font-size: 13px; color: ${color}">${t}</div>`;
const btn = (action, label, primary, extra = '') => `<button type="button" data-action="${action}" ${extra} style="height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: ${primary ? 'var(--accent)' : 'var(--fill)'}; color: ${primary ? 'var(--onAccent)' : 'var(--text)'}; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">${label}</button>`;

function testLabel(p) { return p.test === '1rm' ? 'Test 1RM' : 'Test ponovitev pri isti teži'; }

function rowsHtml(rows) {
  const warm = rows.filter(r => !r.working && r.label === 'ogrevanje');
  const rest = rows.filter(r => !(!r.working && r.label === 'ogrevanje'));
  // Consecutive identical sets as one line ("4 × 8 @ 72,5 kg").
  const groups = [];
  for (const r of rest) {
    const g = groups[groups.length - 1];
    if (g && g.r.kg === r.kg && g.r.reps === r.reps && g.r.label === r.label && !r.label) g.n++;
    else groups.push({ r, n: 1 });
  }
  return `${warm.length ? small(`Ogrevanje: ${warm.map(r => `${fmtKg(r.kg)}×${r.reps}`).join(' · ')}`) : ''}
<div style="display: flex; flex-direction: column; gap: 4px">
${groups.map((g, i) => `<div style="display: flex; justify-content: space-between; gap: 8px; font-size: 15px; ${i ? 'border-top: 1px solid var(--line); padding-top: 4px;' : ''}">
<span style="font-weight: 600">${g.n > 1 ? `${g.n} × ${g.r.reps} @ ${fmtKg(g.r.kg)} kg` : `${fmtKg(g.r.kg)} kg × ${g.r.reps}${g.r.amrap ? '+' : ''}`}</span><span style="color: var(--text2); font-size: 13px">${g.r.label || (g.r.working ? '' : 'dodatno')}</span></div>`).join('')}
</div>`;
}

function activeHtml(data, n, showAll) {
  const { prog, active } = n;
  const pct = Math.round(n.done / n.total * 100);
  const plan = sessionPlan(data, active, n.idx);
  const done = doneSessions(data, active.id);
  const all = prog.build();
  const list = all.map((s, i) => {
    const d = done.find(x => x.idx === i);
    const p = sessionPlan(data, active, i);
    return `<div style="display: flex; gap: 10px; align-items: baseline; padding: 6px 0; ${i ? 'border-top: 1px solid var(--line);' : ''} ${i === n.idx ? 'font-weight: 700;' : ''}">
<span style="width: 44px; flex-shrink: 0; font-size: 12px; color: var(--text2)">${Math.floor(i / PER_WEEK) + 1}. teden</span>
<span style="flex-grow: 1; min-width: 0; font-size: 14px">${escapeHtml(s.name)}<br><span style="font-size: 12px; color: var(--text2); font-weight: 400">${(s.dp || s.rule) && i > n.idx ? 'teža glede na tvoje rezultate' : p.title}</span></span>
<span style="font-size: 12px; flex-shrink: 0; color: ${d ? 'var(--good)' : 'var(--text2)'}">${d ? fmtDateShort(fromIso(d.workout.dateISO)) : i === n.idx ? 'naslednji' : ''}</span>
</div>`;
  }).join('');
  return card(`<div style="display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accentText)">Trenutni program</div>
<div style="font-size: 20px; font-weight: 700">${escapeHtml(prog.name)}</div>
${small(`Začetek ${fmtDate(fromIso(active.startISO))} · 1RM osnova ${fmtKg(active.basis)} kg · ${testLabel(prog)}`)}
</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; justify-content: space-between; font-size: 13px"><span>Trening ${Math.min(n.idx + 1, n.total)} od ${n.total}</span><span style="color: var(--text2)">teden ${n.week} od ${n.weeks} · ta teden ${n.thisWeek}/${PER_WEEK}</span></div>
<div style="height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden"><div style="width: ${pct}%; height: 6px; background: var(--accent)"></div></div>
</div>
<div style="background: var(--fill); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 12px; color: var(--text2)">Naslednji trening · ${escapeHtml(n.sess.name)}</div>
<div style="font-size: 17px; font-weight: 700">${plan.title}</div>
${plan.desc ? small(plan.desc) : ''}
${rowsHtml(plan.rows)}
${n.blocked ? small(n.blocked, 'var(--mood)') : n.warn ? small(n.warn, 'var(--mood)') : ''}
</div>
${n.blocked ? '' : btn('startSession', 'Začni bench trening', true)}
<button type="button" data-action="toggleAll" style="border: 0; background: transparent; padding: 0; color: var(--accentText); font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer">${showAll ? 'Skrij program' : 'Pokaži ves program'}</button>
${showAll ? `<div>${list}</div>` : ''}
<button type="button" data-action="stop" style="border: 0; background: transparent; padding: 0; color: var(--danger); font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer">Prekini program</button>`);
}

function pickHtml(data) {
  const ex = experimentOf(data);
  const next = suggestedNext(data);
  const doneKeys = new Set(ex.history.filter(h => !h.stopped).map(h => h.key));
  return card(`${h2('Izberi program')}
${small(`Vsi programi: bench ${PER_WEEK}× na teden. Teže so izračunane iz tvojega 1RM (${fmtKg(ex.oneRm)} kg).`)}
${[['known', 'Znani programi'], ['method', 'Splošne metode']].map(([g, label]) => `<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2); padding-top: 4px">${label}</div>
${PROGRAMS.filter(p => p.group === g).map(p => `<div style="border-top: 1px solid var(--line); padding-top: 12px; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px">
<span style="font-size: 16px; font-weight: 700">${escapeHtml(p.name)}</span>
<span style="font-size: 12px; color: var(--text2); flex-shrink: 0">${p.weeks} tednov${doneKeys.has(p.key) ? ' · opravljen' : ''}</span>
</div>
${p.origin ? small(escapeHtml(p.origin), 'var(--accentText)') : ''}
${small(p.desc)}
${small(`${testLabel(p)}${p.test === 'reps' ? ` (${fmtKg(repsTestKg(ex.oneRm))} kg)` : ''}`, 'var(--text)')}
<div>${btn('start', p.key === next.key ? 'Začni (predlagan naslednji)' : 'Začni', p.key === next.key, `data-key="${p.key}"`)}</div>
</div>`).join('')}`).join('')}`);
}

function resultsHtml(data) {
  const ex = experimentOf(data);
  if (!ex.history.length) return card(`${h2('Rezultati')}${small('Ko končaš prvi program, se tukaj pokaže, koliko je prinesel.')}`);
  const rows = [...ex.history].reverse().map((h, i) => {
    const p = programByKey(h.key);
    const r = computeResult(data, h);
    return `<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 0; ${i ? 'border-top: 1px solid var(--line);' : ''}">
<div style="display: flex; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 600">${escapeHtml(p ? p.name : h.key)}</span><span style="font-size: 12px; color: var(--text2)">${fmtDateShort(fromIso(h.startISO))} – ${fmtDateShort(fromIso(h.endISO))}</span></div>
<div style="font-size: 14px; color: ${r && ((r.kind === '1rm' && r.kg > r.before) || (r.kind === 'reps' && r.after > r.before)) ? 'var(--good)' : 'var(--text)'}">${resultText(r)}${h.stopped ? ' · prekinjen' : ''}</div>
</div>`;
  }).join('');
  // 1RM over time: the starting basis and every 1RM test.
  const pts = [];
  const first = ex.history[0];
  if (first) pts.push({ v: first.basis, label: fmtDateShort(fromIso(first.startISO)) });
  for (const h of ex.history) {
    const r = computeResult(data, h);
    if (r && r.kind === '1rm') pts.push({ v: r.kg, label: fmtDateShort(fromIso(h.endISO)) });
  }
  return card(`${h2('Rezultati')}
${pts.length > 1 ? `<div style="display: flex; flex-direction: column; gap: 6px">${small('1RM skozi programe')}${lineChartHtml(pts, { fmt: v => fmtKg(Math.round(v * 2) / 2), height: 120 })}</div>` : ''}
<div>${rows}</div>`);
}

function template(data, showAll) {
  const ex = experimentOf(data);
  const n = nextSession(data);
  const first = ex.history.length ? ex.history[0].basis : (ex.active ? ex.active.basis : ex.oneRm);
  const gain = ex.oneRm - first;
  return `
<header style="padding: 16px 12px 0 8px">
<a href="#" data-action="back" style="height: 44px; padding: 0 8px; display: inline-flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Nazaj
</a>
</header>
<main style="padding: 4px 20px 24px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-direction: column; gap: 4px">
<h1 style="margin: 0; font-size: 30px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em">Bench eksperiment</h1>
<div style="font-size: 14px; color: var(--text2)">Program za programom, bench ${PER_WEEK}× na teden. Vsak ima svoj test — na koncu se vidi, kaj prinese največ.</div>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<button type="button" data-action="editOneRm" style="text-align: left; border: 0; background: var(--card); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow); font: inherit; color: var(--text); cursor: pointer">
<span style="font-size: 12px; color: var(--text2)">1RM (uredi)</span><span style="font-size: 17px; font-weight: 700">${fmtKg(ex.oneRm)} kg</span></button>
<div style="background: var(--card); border-radius: 16px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow)">
<span style="font-size: 12px; color: var(--text2)">Od začetka</span><span style="font-size: 17px; font-weight: 700; color: ${gain > 0 ? 'var(--good)' : 'var(--text)'}">${gain >= 0 ? '+' : '−'}${fmtKg(Math.abs(gain))} kg</span></div>
</div>
${n ? activeHtml(data, n, showAll) : pickHtml(data)}
${resultsHtml(data)}
</main>`;
}

export function mount(root, ctx) {
  let showAll = false;
  function render() {
    const data = store.data;
    experimentOf(data);
    root.innerHTML = template(data, showAll);
    root.querySelector('[data-action="back"]').addEventListener('click', (e) => {
      e.preventDefault();
      if (history.length > 1) history.back(); else ctx.navigate('analitika');
    });
    root.querySelector('[data-action="editOneRm"]').addEventListener('click', () => {
      const ex = experimentOf(store.data);
      const val = prompt('Tvoj trenutni 1RM na benchu (kg):', fmtKg(ex.oneRm));
      const num = parseFloat(String(val || '').replace(',', '.'));
      if (num >= 20 && num <= 400) {
        ex.oneRm = Math.round(num * 2) / 2;
        if (ex.active && !doneSessions(store.data, ex.active.id).length) ex.active.basis = ex.oneRm;
        store.save();
      }
    });
    root.querySelectorAll('[data-action="start"]').forEach(b => b.addEventListener('click', () => {
      const ex = experimentOf(store.data);
      const p = programByKey(b.dataset.key);
      const val = prompt(`${p.name}: teže bodo izračunane iz 1RM. Potrdi ali popravi 1RM (kg):`, fmtKg(ex.oneRm));
      if (val === null) return;
      const num = parseFloat(String(val).replace(',', '.'));
      startProgram(store.data, p.key, num >= 20 && num <= 400 ? Math.round(num * 2) / 2 : ex.oneRm);
      store.save();
    }));
    root.querySelector('[data-action="toggleAll"]')?.addEventListener('click', () => { showAll = !showAll; render(); });
    root.querySelector('[data-action="stop"]')?.addEventListener('click', () => {
      if (!confirm('Prekinem program? Opravljeni treningi ostanejo, program se shrani kot prekinjen.')) return;
      stopProgram(store.data);
      store.save();
    });
    root.querySelector('[data-action="startSession"]')?.addEventListener('click', () => {
      const d = store.data;
      if (!d.activeWorkout) {
        d.activeWorkout = { id: uid(), name: 'Bench', startedAt: Date.now(), exercises: [] };
      }
      if (!d.activeWorkout.exercises.some(e => e.name.trim().toLowerCase() === 'bench press')) {
        d.activeWorkout.exercises.unshift({ name: BENCH, muscle: 'Chest', sets: [{ kg: '', reps: '', done: false }] });
      }
      store.save();
      ctx.navigate('nov');
    });
  }
  render();
  return store.subscribe(render);
}
