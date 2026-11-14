import { store, uid } from '../state.js';
import { fromIso, fmtDate, fmtDateShort, escapeHtml } from '../util.js';
import { lineChartHtml } from '../components/lineChart.js';
import {
  PROGRAMS, PER_WEEK, BENCH, programByKey, experimentOf, nextSession, sessionPlan, doneSessions,
  computeResult, resultText, startProgram, stopProgram, suggestedNext, fmtKg, repsTestKg,
  sessionsFor, planStatus, makePlan, acceptPlan
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
  const all = sessionsFor(active);
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
${(() => {
    const ps = planStatus(data);
    const it = ps && active.planIdx != null ? ps.items[active.planIdx] : null;
    return it && it.range ? small(`Načrt ${active.planIdx + 1}/${ps.items.length} · napoved testa: ${kgRange(it.range)}`, 'var(--text)') : '';
  })()}
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

function pickHtml(data, showOthers) {
  const ex = experimentOf(data);
  const next = suggestedNext(data);
  const ps = planStatus(data);
  if (ps && ps.next) {
    const it = ps.next;
    return card(`${h2('Naslednji po načrtu')}
<div style="display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 18px; font-weight: 700">${escapeHtml(it.prog.name)} · ${it.weeks} tednov</div>
${it.prog.origin ? small(escapeHtml(it.prog.origin), 'var(--accentText)') : ''}
${small(it.why)}
${small(`Po načrtu od ${dShort(it.startISO)}. Napoved: +${fmtKg(it.forecast[0])} do +${fmtKg(it.forecast[2])} kg na testu.`, 'var(--text)')}
</div>
${btn('startPlanNext', `Začni ${it.prog.name}`, true)}
<button type="button" data-action="toggleOthers" style="border: 0; background: transparent; padding: 0; color: var(--accentText); font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer">${showOthers ? 'Skrij druge programe' : 'Drugi programi (izven načrta)'}</button>
${showOthers ? pickList(data, next) : ''}`);
  }
  if (ps) return card(`${h2('Načrt je končan')}${small('Vsi programi iz načrta so opravljeni — poglej rezultate spodaj. Lahko začneš katerega koli od programov.')}${pickList(data, next)}`);
  return card(`${h2('Izberi program')}${pickList(data, next)}`);
}

function pickList(data, next) {
  const ex = experimentOf(data);
  const doneKeys = new Set(ex.history.filter(h => !h.stopped).map(h => h.key));
  return (`${small(`Vsi programi: bench ${PER_WEEK}× na teden. Teže so izračunane iz tvojega 1RM (${fmtKg(ex.oneRm)} kg).`)}
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

const kgRange = r => `${fmtKg(r[0])}–${fmtKg(r[2])} kg (pričakovano ${fmtKg(r[1])})`;
const dShort = iso => fmtDateShort(fromIso(iso));
const MONTHS_GEN = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
const untilLabel = iso => { const d = fromIso(iso); return `${d.getDate()}. ${MONTHS_GEN[d.getMonth()]}`; };

// Proposed or running plan until the end of March.
function planHtml(data) {
  const ex = experimentOf(data);
  const ps = planStatus(data);
  if (!ps) {
    const plan = makePlan(data);
    const base = plan.basis;
    let b = base;
    const rows = plan.items.map((it, i) => {
      const p = programByKey(it.key);
      const range = it.forecast.map(f => b + f);
      b += it.forecast[1];
      return `<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-top: 1px solid var(--line)">
<div style="display: flex; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 700">${i + 1}. ${escapeHtml(p.name)}</span><span style="font-size: 12px; color: var(--text2); flex-shrink: 0">${dShort(it.startISO)} – ${dShort(it.endISO)}</span></div>
${small(it.why)}
${small(`Test 1RM na koncu: ${kgRange(range)}${i ? ' — če prejšnji pride na pričakovano' : ''}`, 'var(--text)')}
${i === 0 && plan.breakWeek ? small(`Nato ${dShort(plan.breakWeek.startISO)} – ${dShort(plan.breakWeek.endISO)}: lahek teden (prazniki), brez programa.`, 'var(--mood)') : ''}
</div>`;
    }).join('');
    const fin = plan.final.map(f => base + f);
    return card(`${h2(`Predlog: načrt do ${untilLabel(plan.endISO)}`)}
${small(`3 programi po 6 tednov, bench ${PER_WEEK}× na teden, vsak se konča s testom 1RM — tako so rezultati primerljivi. Začetek ${dShort(plan.items[0].startISO)}, osnova ${fmtKg(base)} kg.`)}
<div>${rows}</div>
<div style="background: var(--fill); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 12px; color: var(--text2)">Vrh moči na zadnjem testu</div>
<div style="font-size: 17px; font-weight: 700">${fmtKg(fin[1])} kg</div>
${small(`Spodnja meja ${fmtKg(fin[0])} kg · zgornja ${fmtKg(fin[2])} kg`)}
</div>
${btn('acceptPlan', ex.active ? 'Sprejmi načrt (prekine trenutni program)' : 'Sprejmi načrt', true)}`);
  }
  const fin = ps.final;
  const rows = ps.items.map((it, i) => {
    const status = it.state === 'done'
      ? `<span style="color: ${it.verdict && it.verdict.startsWith('pod') ? 'var(--danger)' : 'var(--good)'}">${resultText(it.result)}${it.verdict ? ` · ${it.verdict}` : ''}${it.hist.rating ? ` · ocena ${it.hist.rating}/5` : ''}</span>`
      : it.state === 'running' ? '<span style="color: var(--accentText); font-weight: 600">teče zdaj</span>'
        : `<span style="color: var(--text2)">od ${dShort(it.startISO)}</span>`;
    return `<div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 0; border-top: 1px solid var(--line)">
<div style="display: flex; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 700">${i + 1}. ${escapeHtml(it.prog.name)}</span><span style="font-size: 12px; color: var(--text2); flex-shrink: 0">${dShort(it.startISO)} – ${dShort(it.endISO)}</span></div>
<div style="font-size: 13px">${status}</div>
${it.range ? small(`Napoved: ${kgRange(it.range)}`) : small(`Napoved: +${fmtKg(it.forecast[0])} do +${fmtKg(it.forecast[2])} kg (pričakovano +${fmtKg(it.forecast[1])})`)}
${i === 0 && ps.plan.breakWeek ? small(`${dShort(ps.plan.breakWeek.startISO)} – ${dShort(ps.plan.breakWeek.endISO)}: lahek teden, brez programa.`, 'var(--mood)') : ''}
</div>`;
  }).join('');
  const now = ex.oneRm;
  return card(`${h2(`Načrt do ${untilLabel(ps.plan.endISO)}`)}
<div>${rows}</div>
<div style="background: var(--fill); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 12px; color: var(--text2)">Vrh moči na zadnjem testu</div>
<div style="font-size: 17px; font-weight: 700">pričakovano ${fmtKg(fin[1])} kg</div>
${small(`Spodnja meja ${fmtKg(fin[0])} kg · zgornja ${fmtKg(fin[2])} kg · zdaj ${fmtKg(now)} kg`)}
${ps.adapted ? small(ps.adj > 0 ? `Napoved je dvignjena za ${fmtKg(ps.adj)} kg na program — napreduješ hitreje od pričakovanega.` : ps.adj < 0 ? `Napoved je znižana za ${fmtKg(-ps.adj)} kg na program — napredek je počasnejši od pričakovanega.` : 'Napredek gre po napovedi.', 'var(--accentText)') : small('Napoved se po vsakem testu prilagodi tvojemu dejanskemu tempu.')}
</div>
${small('Razlika 2,5 kg med programi je v okviru dnevnega nihanja, zato štejeta tudi ocena programa in kako so šli treningi.')}
<button type="button" data-action="dropPlan" style="border: 0; background: transparent; padding: 0; color: var(--text2); font: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer">Opusti načrt</button>`);
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
${h.stopped ? '' : `<div style="display: flex; align-items: center; gap: 6px; padding-top: 4px; flex-wrap: wrap">
<span style="font-size: 12px; color: var(--text2)">Kako ti je ustrezal?</span>
${[1, 2, 3, 4, 5].map(v => `<button type="button" data-rate="${h.id}" data-v="${v}" aria-label="Ocena ${v}" style="width: 32px; height: 32px; border: 0; border-radius: 16px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; ${h.rating === v ? 'background: var(--accent); color: var(--onAccent);' : 'background: var(--fill); color: var(--text2);'}">${v}</button>`).join('')}
</div>`}
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

function template(data, showAll, showOthers) {
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
${planStatus(data) ? '' : planHtml(data)}
${n ? activeHtml(data, n, showAll) : pickHtml(data, showOthers)}
${planStatus(data) ? planHtml(data) : ''}
${resultsHtml(data)}
</main>`;
}

export function mount(root, ctx) {
  let showAll = false, showOthers = false;
  function render() {
    const data = store.data;
    experimentOf(data);
    root.innerHTML = template(data, showAll, showOthers);
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
    root.querySelector('[data-action="toggleOthers"]')?.addEventListener('click', () => { showOthers = !showOthers; render(); });
    root.querySelector('[data-action="acceptPlan"]')?.addEventListener('click', () => {
      const ex = experimentOf(store.data);
      if (ex.active && !confirm('Trenutni program se prekine (opravljeni treningi ostanejo). Sprejmem načrt?')) return;
      acceptPlan(store.data);
      store.save();
    });
    root.querySelector('[data-action="dropPlan"]')?.addEventListener('click', () => {
      if (!confirm('Opustim načrt? Programi in rezultati ostanejo.')) return;
      delete experimentOf(store.data).plan;
      store.save();
    });
    root.querySelector('[data-action="startPlanNext"]')?.addEventListener('click', () => {
      const ex = experimentOf(store.data);
      const ps = planStatus(store.data);
      if (!ps || !ps.next) return;
      const val = prompt(`${ps.next.prog.name}: teže bodo izračunane iz 1RM. Potrdi ali popravi 1RM (kg):`, fmtKg(ex.oneRm));
      if (val === null) return;
      const num = parseFloat(String(val).replace(',', '.'));
      startProgram(store.data, ps.next.key, num >= 20 && num <= 400 ? Math.round(num * 2) / 2 : ex.oneRm, new Date(), { weeks: ps.next.weeks, planIdx: ps.next.idx });
      store.save();
    });
    root.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
      const h = experimentOf(store.data).history.find(x => x.id === b.dataset.rate);
      if (h) { h.rating = Number(b.dataset.v); store.save(); }
    }));
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
