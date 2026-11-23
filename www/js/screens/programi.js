import { store, uid, isoDate } from '../state.js';
import { fromIso, fmtDate, fmtDateShort, escapeHtml } from '../util.js';
import { hm } from '../analysis.js';
import {
  LIFTS, CORE, FULL_PROGRAMS, GROUPS, fullProgramByKey, programsOf, getOneRm, setOneRm, estimateOneRm,
  nextFullSession, sessionPrescription, sessionsOf, programWorkouts, workoutForSession, startFullProgram,
  stopFullProgram, programResult, correlation, fmtKg
} from '../programs.js';
import { experimentOf, stopProgram as stopBenchProgram } from '../experiment.js';
import { openPhotoAdd, openPhotoViewer } from '../components/photoSheets.js';

const card = inner => `<section style="background: var(--card); border-radius: 22px; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow)">${inner}</section>`;
const h2 = t => `<h2 style="margin: 0; font-size: 15px; font-weight: 600">${t}</h2>`;
const small = (t, color = 'var(--text2)') => `<div style="font-size: 13px; color: ${color}">${t}</div>`;
const btn = (action, label, primary, extra = '') => `<button type="button" data-action="${action}" ${extra} style="height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: ${primary ? 'var(--accent)' : 'var(--fill)'}; color: ${primary ? 'var(--onAccent)' : 'var(--text)'}; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">${label}</button>`;
const link = (action, label, color = 'var(--accentText)') => `<button type="button" data-action="${action}" style="border: 0; background: transparent; padding: 0; color: ${color}; font: inherit; font-size: 14px; font-weight: 600; text-align: left; cursor: pointer">${label}</button>`;
const signed = (v, unit = ' kg') => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${fmtKg(Math.abs(Math.round(v * 10) / 10))}${unit}`);

function oneRmTiles(data) {
  return `<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px">
${CORE.map(l => `<button type="button" data-edit-rm="${l}" style="text-align: left; border: 0; background: var(--card); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow); font: inherit; color: var(--text); cursor: pointer; min-width: 0">
<span style="font-size: 11px; color: var(--text2)">${LIFTS[l].label}</span><span style="font-size: 15px; font-weight: 700">${getOneRm(data, l) ? fmtKg(getOneRm(data, l)) : '—'}</span></button>`).join('')}
</div>`;
}

function activeHtml(data, n, showAll) {
  const pr = sessionPrescription(data, n.active, n.idx);
  const done = programWorkouts(data, n.active.id);
  const pct = Math.round(n.done / n.total * 100);
  const res = programResult(data, n.active);
  const photoHint = !res.photosAtStart && n.done < n.prog.days
    ? `<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--fill); border-radius: 12px; padding: 10px 12px"><span style="font-size: 13px">Naredi začetne slike (spredaj, s strani, zadaj) — na koncu jih primerjaš.</span>${btn('photoNow', 'Slike', false)}</div>`
    : n.test ? `<div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; background: var(--fill); border-radius: 12px; padding: 10px 12px"><span style="font-size: 13px">Testni teden: naredi še končne slike za primerjavo.</span>${btn('photoNow', 'Slike', false)}</div>` : '';
  const all = sessionsOf(n.active);
  const list = all.map((s, i) => {
    const d = done.find(x => x.idx === i);
    return `<div style="display: flex; gap: 10px; align-items: baseline; padding: 6px 0; ${i ? 'border-top: 1px solid var(--line);' : ''} ${i === n.idx ? 'font-weight: 700;' : ''}">
<span style="width: 52px; flex-shrink: 0; font-size: 12px; color: var(--text2)">${s.test ? 'test' : `${Math.floor(i / n.prog.days) + 1}. teden`}</span>
<span style="flex-grow: 1; min-width: 0; font-size: 14px">${escapeHtml(s.name)}</span>
<span style="font-size: 12px; flex-shrink: 0; color: ${d ? 'var(--good)' : 'var(--text2)'}">${d ? fmtDateShort(fromIso(d.workout.dateISO)) : i === n.idx ? 'naslednji' : ''}</span>
</div>`;
  }).join('');
  return card(`<div style="display: flex; flex-direction: column; gap: 4px">
<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accentText)">Trenutni program</div>
<div style="font-size: 20px; font-weight: 700">${escapeHtml(n.prog.name)}</div>
${small(`${escapeHtml(n.prog.origin)} · ${n.prog.days}× na teden · začetek ${fmtDate(fromIso(n.active.startISO))}`)}
</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; justify-content: space-between; font-size: 13px"><span>Trening ${n.idx + 1} od ${n.total}</span><span style="color: var(--text2)">teden ${n.week} od ${n.weeks} · ta teden ${n.thisWeek}/${n.prog.days}</span></div>
<div style="height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden"><div style="width: ${pct}%; height: 6px; background: var(--accent)"></div></div>
</div>
${photoHint}
<div style="background: var(--fill); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 12px; color: var(--text2)">Naslednji trening${n.test ? ' · testni teden' : ''}</div>
<div style="font-size: 17px; font-weight: 700">${escapeHtml(n.sess.name)}</div>
${pr.exercises.map(e => `<div style="display: flex; justify-content: space-between; gap: 10px; font-size: 14px; border-top: 1px solid var(--line); padding-top: 6px"><span style="font-weight: 600; min-width: 0">${escapeHtml(e.name)}</span><span style="color: var(--text2); text-align: right">${escapeHtml(e.title)}</span></div>`).join('')}
${n.blocked ? small(n.blocked, 'var(--mood)') : ''}
</div>
${n.blocked ? '' : btn('startSession', 'Začni trening', true)}
${link('toggleAll', showAll ? 'Skrij program' : 'Pokaži ves program')}
${showAll ? `<div>${list}</div>` : ''}
${link('stop', 'Prekini program', 'var(--danger)')}`);
}

function libraryHtml(data, showLib, hasActive) {
  const st = programsOf(data);
  const doneKeys = new Set(st.history.filter(h => !h.stopped).map(h => h.key));
  const body = GROUPS.map(([g, label]) => `<div style="font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text2); padding-top: 4px">${label}</div>
${FULL_PROGRAMS.filter(p => p.group === g).map(p => `<div style="border-top: 1px solid var(--line); padding-top: 12px; display: flex; flex-direction: column; gap: 6px">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px">
<span style="font-size: 16px; font-weight: 700">${escapeHtml(p.name)}</span>
<span style="font-size: 12px; color: var(--text2); flex-shrink: 0">${p.days}× na teden · ${p.weeks} t.${doneKeys.has(p.key) ? ' · opravljen' : ''}</span>
</div>
${small(escapeHtml(p.origin), 'var(--accentText)')}
${small(escapeHtml(p.desc))}
<div>${btn('start', 'Začni', false, `data-key="${p.key}"`)}</div>
</div>`).join('')}`).join('');
  if (hasActive) {
    return card(`${h2('Knjižnica programov')}
${small(`${FULL_PROGRAMS.length} programov. Naslednjega izbereš, ko končaš trenutnega.`)}
${link('toggleLib', showLib ? 'Skrij knjižnico' : 'Pokaži knjižnico')}
${showLib ? body : ''}`);
  }
  return card(`${h2('Izberi program')}
${small('Vsak program se konča s testnim tednom (1RM na benchu, počepu, mrtvem in OHP), zato so rezultati primerljivi med programi — tudi čez leta.')}
${body}`);
}

function resultsHtml(data) {
  const st = programsOf(data);
  const runs = st.history.filter(h => !h.stopped || programWorkouts(data, h.id).length);
  if (!runs.length) return card(`${h2('Rezultati programov')}${small('Ko končaš prvi program, se tukaj pokaže, koliko moči je prinesel, kako se je spremenila teža in primerjava slik.')}`);
  const results = runs.map(h => ({ h, r: programResult(data, h) }));
  const rows = [...results].reverse().map(({ h, r }, i) => `<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px 0; ${i ? 'border-top: 1px solid var(--line);' : ''}">
<div style="display: flex; justify-content: space-between; gap: 8px"><span style="font-size: 15px; font-weight: 700">${escapeHtml(r.prog ? r.prog.name : h.key)}</span><span style="font-size: 12px; color: var(--text2); flex-shrink: 0">${fmtDateShort(fromIso(h.startISO))} – ${fmtDateShort(fromIso(h.endISO))}${h.stopped ? ' · prekinjen' : ''}</span></div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px">
${CORE.map(l => { const x = r.lifts[l]; return `<div style="background: var(--fill); border-radius: 10px; padding: 6px 8px; min-width: 0"><div style="font-size: 11px; color: var(--text2)">${LIFTS[l].label}</div><div style="font-size: 13px; font-weight: 700; color: ${x.diff > 0 ? 'var(--good)' : x.diff < 0 ? 'var(--danger)' : 'var(--text)'}">${x.diff != null ? signed(x.diff, '') : '—'}</div><div style="font-size: 11px; color: var(--text2)">${x.after ? fmtKg(x.after) : fmtKg(x.before)}</div></div>`; }).join('')}
</div>
${small(`Skupaj ${signed(r.totalDiff)}${r.perWeek != null ? ` (${signed(r.perWeek, ' kg/teden')})` : ''} · teža ${signed(r.weight.diff)} · ${r.done}/${r.planned} treningov${r.sleep != null ? ` · spanec ${hm(r.sleep)}` : ''}`, 'var(--text)')}
<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap">
<span style="font-size: 12px; color: var(--text2)">Ocena:</span>
${[1, 2, 3, 4, 5].map(v => `<button type="button" data-rate="${h.id}" data-v="${v}" aria-label="Ocena ${v}" style="width: 30px; height: 30px; border: 0; border-radius: 15px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; ${h.rating === v ? 'background: var(--accent); color: var(--onAccent);' : 'background: var(--fill); color: var(--text2);'}">${v}</button>`).join('')}
${r.photoPair ? `<button type="button" data-photos="${r.photoPair[0].id}:${r.photoPair[1].id}" style="margin-left: auto; height: 30px; padding: 0 12px; border: 0; border-radius: 15px; background: var(--accentSoft); color: var(--accentText); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer">Slike prej/potem</button>` : ''}
</div>
</div>`).join('');
  return card(`${h2('Rezultati programov')}<div>${rows}</div>`) + insightsHtml(results);
}

// What the finished programs say so far: best for strength and for bodyweight,
// and — once there are enough — what goes together with more strength.
function insightsHtml(results) {
  const full = results.filter(x => !x.h.stopped && x.r.perWeek != null);
  if (full.length < 2) {
    return card(`${h2('Kaj najbolj vpliva')}${small(`Primerjava se začne, ko imaš vsaj 2 končana programa s testi (zdaj ${full.length}). Povezave s spancem, stresom in težo se pokažejo pri 4 ali več.`)}`);
  }
  const best = [...full].sort((a, b) => b.r.perWeek - a.r.perWeek)[0];
  const withW = full.filter(x => x.r.weight.diff != null);
  const gain = withW.length ? [...withW].sort((a, b) => b.r.weight.diff - a.r.weight.diff)[0] : null;
  const rated = full.filter(x => x.h.rating);
  const fav = rated.length ? [...rated].sort((a, b) => b.h.rating - a.h.rating)[0] : null;
  const lines = [
    `<b>Največ moči:</b> ${escapeHtml(best.r.prog.name)} — ${signed(best.r.perWeek, ' kg/teden')} na skupnem 1RM (${signed(best.r.totalDiff)} v ${Math.round(best.r.weeks)} tednih).`,
    gain ? `<b>Največ telesne teže:</b> ${escapeHtml(gain.r.prog.name)} (${signed(gain.r.weight.diff)}).` : '',
    fav ? `<b>Najbolj ti je ustrezal:</b> ${escapeHtml(fav.r.prog.name)} (ocena ${fav.h.rating}/5).` : ''
  ].filter(Boolean);
  const per = full.map(x => x.r.perWeek);
  const facts = [
    ['spanec', full.map(x => x.r.sleep)],
    ['stres', full.map(x => x.r.stress)],
    ['sprememba teže', full.map(x => x.r.weight.diff)],
    ['opravljeni treningi', full.map(x => x.r.done / x.r.planned)]
  ].map(([label, xs]) => ({ label, c: correlation(xs, per) })).filter(f => f.c != null && Math.abs(f.c) >= 0.4);
  const corr = facts.map(f => `${f.c > 0 ? 'Več' : 'Manj'} ${f.label === 'opravljeni treningi' ? 'opravljenih treningov' : f.label === 'sprememba teže' ? 'pridobljene teže' : f.label + 'a'} → več moči (r = ${String(Math.round(f.c * 100) / 100).replace('.', ',')}).`);
  return card(`${h2('Kaj najbolj vpliva')}
${lines.map(l => `<div style="font-size: 14px">${l}</div>`).join('')}
${corr.length ? `<div style="font-size: 14px; display: flex; flex-direction: column; gap: 4px">${corr.map(c => `<div>${c}</div>`).join('')}</div>` : full.length >= 4 ? small('Med programi še ni jasne povezave s spancem, stresom ali težo.') : ''}
${small('Programi si sledijo, zato vsak gradi na prejšnjem; 2,5 kg razlike je v okviru dnevnega nihanja. Zanesljivejša slika pride z več programi.')}`);
}

function template(data, showAll, showLib) {
  const n = nextFullSession(data);
  const st = programsOf(data);
  return `
<header style="padding: 16px 12px 0 8px">
<a href="#" data-action="back" style="height: 44px; padding: 0 8px; display: inline-flex; align-items: center; gap: 2px; color: var(--accentText); text-decoration: none; font-size: 16px; font-weight: 500">
<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
Nazaj
</a>
</header>
<main style="padding: 4px 20px 24px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-direction: column; gap: 4px">
<h1 style="margin: 0; font-size: 30px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em">Programi</h1>
<div style="font-size: 14px; color: var(--text2)">Celotni programi za vse skupine. Vsak se konča s testom — čez leta se vidi, kaj ti najbolj prinese moč in rast.</div>
</div>
<div style="display: flex; flex-direction: column; gap: 6px">${small('1RM (tapni za urejanje)')}${oneRmTiles(data)}</div>
${n ? activeHtml(data, n, showAll) : ''}
${libraryHtml(data, showLib, !!st.active)}
${resultsHtml(data)}
</main>`;
}

// Start sheet: confirm the four 1RMs the program's weights and tests come from.
function openStart(prog, onDone) {
  const data = store.data;
  const values = {};
  const rowsHtml = CORE.map(l => {
    const known = getOneRm(data, l);
    const est = known ? null : estimateOneRm(data, l);
    values[l] = known || est || '';
    return `<label style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 15px; font-weight: 600">${LIFTS[l].label}</span><span style="font-size: 12px; color: var(--text2)">${known ? 'zadnji 1RM' : est ? 'ocena iz treningov' : 'ni podatka'}</span></span>
<span style="display: flex; align-items: center; gap: 6px"><input type="text" inputmode="decimal" data-rm="${l}" value="${values[l] ? fmtKg(values[l]) : ''}" placeholder="kg" style="width: 84px; height: 40px; border: 0; border-radius: 10px; background: var(--fill); text-align: center; font: inherit; font-size: 16px; font-weight: 600; color: var(--text)"><span style="color: var(--text2)">kg</span></span>
</label>`;
  }).join('');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: flex-end;';
  const bench = experimentOf(data).active;
  const other = programsOf(data).active;
  overlay.innerHTML = `<div style="background: var(--bg); width: 100%; max-width: 560px; margin: 0 auto; max-height: 88vh; border-radius: 20px 20px 0 0; display: flex; flex-direction: column; overflow: hidden">
<div style="padding: 16px 20px 8px; font-size: 19px; font-weight: 700">${escapeHtml(prog.name)}</div>
<div style="overflow-y: auto; padding: 4px 20px calc(env(safe-area-inset-bottom, 0px) + 20px); display: flex; flex-direction: column; gap: 12px">
<div style="font-size: 13px; color: var(--text2)">Teže programa in testi na koncu izhajajo iz 1RM. Popravi, če ne drži.</div>
${rowsHtml}
${bench ? '<div style="font-size: 13px; color: var(--mood)">Bench eksperiment se bo prekinil (opravljeni treningi ostanejo).</div>' : ''}
${other ? '<div style="font-size: 13px; color: var(--mood)">Trenutni program se bo prekinil (opravljeni treningi ostanejo).</div>' : ''}
<button type="button" data-go style="height: 50px; border: 0; border-radius: 14px; background: var(--accent); color: var(--onAccent); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer">Začni program</button>
<button type="button" data-cancel style="height: 40px; border: 0; background: transparent; color: var(--text2); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">Prekliči</button>
</div></div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-cancel]').onclick = close;
  overlay.querySelector('[data-go]').onclick = () => {
    const oneRm = {};
    for (const l of CORE) {
      const num = parseFloat(String(overlay.querySelector(`[data-rm="${l}"]`).value).replace(',', '.'));
      if (!(num >= 20 && num <= 500)) { alert(`Vpiši 1RM za ${LIFTS[l].label} (kg).`); return; }
      oneRm[l] = Math.round(num * 2) / 2;
    }
    if (bench) stopBenchProgram(store.data);
    if (other) stopFullProgram(store.data);
    startFullProgram(store.data, prog.key, oneRm);
    store.save();
    close();
    if (onDone) onDone();
  };
}

export function mount(root, ctx) {
  let showAll = false, showLib = false;
  function render() {
    const data = store.data;
    programsOf(data);
    root.innerHTML = template(data, showAll, showLib);
    root.querySelector('[data-action="back"]').addEventListener('click', (e) => {
      e.preventDefault();
      if (history.length > 1) history.back(); else ctx.navigate('trening');
    });
    root.querySelectorAll('[data-edit-rm]').forEach(b => b.addEventListener('click', () => {
      const l = b.dataset.editRm;
      const val = prompt(`1RM za ${LIFTS[l].label} (kg):`, getOneRm(store.data, l) ? fmtKg(getOneRm(store.data, l)) : '');
      const num = parseFloat(String(val || '').replace(',', '.'));
      if (num >= 20 && num <= 500) { setOneRm(store.data, l, Math.round(num * 2) / 2); store.save(); }
    }));
    root.querySelectorAll('[data-action="start"]').forEach(b => b.addEventListener('click', () => openStart(fullProgramByKey(b.dataset.key))));
    root.querySelector('[data-action="toggleAll"]')?.addEventListener('click', () => { showAll = !showAll; render(); });
    root.querySelector('[data-action="toggleLib"]')?.addEventListener('click', () => { showLib = !showLib; render(); });
    root.querySelector('[data-action="stop"]')?.addEventListener('click', () => {
      if (!confirm('Prekinem program? Opravljeni treningi ostanejo, program se shrani kot prekinjen.')) return;
      stopFullProgram(store.data);
      store.save();
    });
    root.querySelector('[data-action="photoNow"]')?.addEventListener('click', () => openPhotoAdd({ dateISO: isoDate(new Date()) }));
    root.querySelector('[data-action="startSession"]')?.addEventListener('click', () => {
      const d = store.data;
      if (d.activeWorkout) {
        if (!confirm('Trening že teče. Ga zavržem in začnem trening programa?')) { ctx.navigate('nov'); return; }
      }
      const n = nextFullSession(d);
      if (!n || n.blocked) return;
      d.activeWorkout = workoutForSession(d, n, uid);
      store.save();
      ctx.navigate('nov');
    });
    root.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
      const h = programsOf(store.data).history.find(x => x.id === b.dataset.rate);
      if (h) { h.rating = Number(b.dataset.v); store.save(); }
    }));
    root.querySelectorAll('[data-photos]').forEach(b => b.addEventListener('click', () => {
      const [a, z] = b.dataset.photos.split(':');
      openPhotoViewer(z, { compare: true, baseId: a });
    }));
  }
  render();
  return store.subscribe(render);
}
