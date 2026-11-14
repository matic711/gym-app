// Bench press experiment: one program after another, bench twice a week, each
// program with its own test, to see which one brings the most. Loads are a
// percentage of the 1RM the program started with.
import { isoDate, fromIso, addDays, startOfWeek } from './util.js';

export const BENCH = 'Bench Press';
export const PER_WEEK = 2;
export function isBench(name) { return String(name || '').trim().toLowerCase() === 'bench press'; }

const r25 = kg => Math.round(kg / 2.5) * 2.5;
const f25 = kg => Math.floor(kg / 2.5 + 1e-9) * 2.5;
export function fmtKg(kg) { return Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ','); }

// A block of working sets: sets × reps at pct % of the 1RM.
const B = (sets, reps, pct, extra = {}) => ({ sets, reps, pct, ...extra });

// ---- programs ---------------------------------------------------------------

function linear() {
  const s = [];
  const hyp = [65, 67.5, 70], hypB = [57.5, 60, 62.5];
  hyp.forEach((p, i) => { s.push({ key: 'A', name: 'Hipertrofija', blocks: [B(4, 8, p)] }, { key: 'B', name: 'Hipertrofija, lažje', blocks: [B(3, 10, hypB[i])] }); });
  const str = [72.5, 75, 77.5], strB = [67.5, 70, 72.5];
  str.forEach((p, i) => { s.push({ key: 'A', name: 'Moč', blocks: [B(5, 5, p)] }, { key: 'B', name: 'Moč, lažje', blocks: [B(4, 6, strB[i])] }); });
  s.push({ key: 'A', name: 'Vrh', blocks: [B(5, 3, 85)] }, { key: 'B', name: 'Vrh, lažje', blocks: [B(3, 3, 80)] });
  s.push({ key: 'A', name: 'Pred testom', blocks: [B(3, 2, 80)] }, { key: 'T', name: 'Test 1RM', test: '1rm' });
  return s;
}

function dup() {
  const heavy = [[5, 3, 80], [5, 3, 82.5], [4, 3, 85], [4, 2, 87.5], [3, 1, 92.5], [3, 2, 80]];
  const vol = [[4, 8, 65], [4, 8, 67.5], [4, 7, 70], [4, 6, 72.5], [3, 5, 75]];
  const s = [];
  for (let w = 0; w < 6; w++) {
    s.push({ key: 'A', name: w === 5 ? 'Težki dan, lažje pred testom' : 'Težki dan', blocks: [B(...heavy[w])] });
    s.push(w === 5 ? { key: 'T', name: 'Test 1RM', test: '1rm' } : { key: 'B', name: 'Volumen', blocks: [B(...vol[w])] });
  }
  return s;
}

// 5/3/1: percentages of a training max (90 % of the 1RM); the second cycle adds 2,5 kg.
function wendler() {
  const TM = 0.9;
  const main = [
    [[65, 5], [75, 5], [85, 5, true]],
    [[70, 3], [80, 3], [90, 3, true]],
    [[75, 5], [85, 3], [95, 1, true]],
    [[40, 5], [50, 5], [60, 5]]
  ];
  const bbb = [[5, 10, 50], [5, 10, 55], [5, 10, 60], [3, 5, 50]];
  const s = [{ key: 'T0', name: 'Začetni test', test: 'reps' }];
  for (let c = 0; c < 2; c++) {
    const add = c * 2.5;
    for (let w = 0; w < 4; w++) {
      const deload = w === 3;
      s.push({ key: 'A', name: deload ? '5/3/1 · razbremenitev' : `5/3/1 · ${['5+', '3+', '5/3/1+'][w]}`,
        blocks: main[w].map(([p, r, amrap]) => B(1, r, p * TM, { add, amrap: !!amrap })) });
      if (c === 1 && deload) s.push({ key: 'T', name: 'Končni test', test: 'reps' });
      else s.push({ key: 'B', name: deload ? 'Volumen · razbremenitev' : 'Volumen (5 × 10)', blocks: [B(bbb[w][0], bbb[w][1], bbb[w][2] * TM, { add })] });
    }
  }
  return s;
}

function doubleProg() {
  const s = [{ key: 'T0', name: 'Začetni test', test: 'reps' }];
  for (let w = 0; w < 6; w++) {
    s.push({ key: 'A', name: 'Težji · 3 × 6–8', dp: { sets: 3, min: 6, max: 8, startPct: 75 } });
    s.push({ key: 'B', name: 'Lažji · 3 × 10–12', dp: { sets: 3, min: 10, max: 12, startPct: 62.5 } });
  }
  s.push({ key: 'T', name: 'Končni test', test: 'reps' });
  return s;
}

function paused() {
  const a = [[5, 4, 70], [5, 4, 72.5], [5, 3, 75], [5, 3, 77.5], [4, 2, 82.5], [3, 2, 75]];
  const b = [[4, 6, 62.5], [4, 6, 65], [4, 5, 67.5], [4, 5, 70], [3, 5, 70]];
  const s = [];
  for (let w = 0; w < 6; w++) {
    s.push({ key: 'A', name: 'Pavza 2 s na prsih', blocks: [B(...a[w])] });
    s.push(w === 5 ? { key: 'T', name: 'Test 1RM (brez pavze)', test: '1rm' } : { key: 'B', name: 'Počasen spust (3 s)', blocks: [B(...b[w])] });
  }
  return s;
}

// Sheiko-style bench: lots of sets of 2–5 reps at 70–85 %, pyramids, rarely
// above 90 %. The 50–60 % sets are part of the program (its own warm-up).
function sheiko() {
  const W = (p, r, sets = 1) => B(sets, r, p, { warm: p <= 60 });
  const weeks = [
    [[W(50, 5), W(60, 4), W(70, 3, 2), W(75, 3, 5)], [W(50, 6), W(60, 6), W(70, 6, 4)]],
    [[W(50, 5), W(60, 4), W(70, 3), W(80, 2, 5)], [W(50, 5), W(60, 5), W(70, 4, 5)]],
    [[W(50, 5), W(60, 4), W(70, 3), W(80, 3, 2), W(85, 2, 3), W(80, 3, 2)], [W(55, 5), W(65, 5), W(75, 4, 4)]],
    [[W(50, 5), W(60, 4), W(70, 3, 2), W(75, 3, 4)], [W(50, 6), W(60, 6), W(65, 6, 3)]],
    [[W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(85, 2, 4)], [W(50, 5), W(60, 4), W(70, 3, 2), W(75, 3, 4)]],
    [[W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(90, 1, 3), W(85, 2, 2)], [W(50, 5), W(60, 5), W(70, 4, 4)]],
    [[W(50, 3), W(60, 3), W(70, 3), W(80, 2, 2), W(85, 2, 3)], [W(50, 5), W(60, 4), W(70, 3, 3)]],
    [[W(50, 3), W(60, 3), W(70, 3, 2), W(75, 2, 3)], null]
  ];
  const s = [];
  weeks.forEach(([a, b], w) => {
    const phase = w < 4 ? 'Pripravljalna faza' : 'Tekmovalna faza';
    s.push({ key: 'A', name: `${phase} · težji dan`, blocks: a });
    s.push(b ? { key: 'B', name: `${phase} · volumen`, blocks: b } : { key: 'T', name: 'Test 1RM', test: '1rm' });
  });
  return s;
}

// GZCLP: T1 bench 5 × 3+ and T2 bench 3 × 10, progression from the results.
function gzclp() {
  const s = [];
  for (let w = 0; w < 8; w++) {
    s.push({ key: 'A', name: 'T1 (težko)', rule: 'gzT1' });
    s.push(w === 7 ? { key: 'T', name: 'Test 1RM', test: '1rm' } : { key: 'B', name: 'T2 (volumen)', rule: 'gzT2' });
  }
  return s;
}

// Texas Method, two days: volume 5 × 5 at 90 %, intensity 1 × 5 at a new best.
function texas() {
  const s = [];
  for (let w = 0; w < 8; w++) {
    s.push({ key: 'V', name: 'Dan volumna', rule: 'txV' });
    s.push(w === 7 ? { key: 'T', name: 'Test 1RM', test: '1rm' } : { key: 'I', name: 'Dan intenzivnosti', rule: 'txI' });
  }
  return s;
}

export const PROGRAMS = [
  { key: 'sheiko', group: 'known', name: 'Sheiko', weeks: 8, test: '1rm', build: sheiko,
    origin: 'Boris Šejko · samo bench del, prilagojen na 2× na teden (original ima bench 3× ter počep in mrtvi dvig)',
    desc: 'Veliko serij po 2–5 ponovitev pri 70–85 %, piramide, redko nad 90 % — tehnika in volumen brez odpovedi. 4 tedne pripravljalne in 4 tedne tekmovalne faze, na koncu test 1RM.' },
  { key: '531', group: 'known', name: '5/3/1 Boring But Big', weeks: 9, test: 'reps', build: wendler,
    origin: 'Jim Wendler · glavni dan 5/3/1 in dan 5 × 10 (BBB) kot drugi bench dan',
    desc: 'Glavni dan 5/3/1 z zadnjo serijo do odpovedi (+), drugi dan 5 × 10 pri 50–60 %. Teže iz trening maksa (90 % 1RM), drugi cikel +2,5 kg. Test: ponovitve pri isti teži na začetku in na koncu.' },
  { key: 'gzclp', group: 'known', name: 'GZCLP', weeks: 8, test: '1rm', build: gzclp,
    origin: 'Cody Lefever (GZCL) · T1 in T2 bench',
    desc: 'T1: 5 × 3+ in vsakič +2,5 kg; ko ne gre, 6 × 2+, nato 10 × 1+, potem nov začetek. T2: 3 × 10 → 3 × 8 → 3 × 6. Teže se prilagajajo tvojim rezultatom. Na koncu test 1RM.' },
  { key: 'texas', group: 'known', name: 'Texas Method', weeks: 8, test: '1rm', build: texas,
    origin: 'Mark Rippetoe / Glenn Pendlay · 2-dnevna različica (brez dneva za regeneracijo)',
    desc: 'Dan volumna 5 × 5 pri 90 % teže dneva intenzivnosti, dan intenzivnosti 1 × 5 z novim rekordom — vsak teden +2,5 kg. Če 5 ne gre, ostaneš na isti teži. Na koncu test 1RM.' },
  { key: 'linear', group: 'method', name: 'Linearna periodizacija', weeks: 8, test: '1rm', build: linear,
    desc: 'Od hipertrofije (4 × 8) prek moči (5 × 5) do vrha (5 × 3). Klasika: vsak teden malo težje, na koncu test 1RM.' },
  { key: 'dup', group: 'method', name: 'DUP: težko + volumen', weeks: 6, test: '1rm', build: dup,
    desc: 'En dan težke trojke in dvojke (80–92,5 %), drugi dan volumen (4 × 8 → 3 × 5). Na koncu test 1RM.' },
  { key: 'dp', group: 'method', name: 'Double progression', weeks: 7, test: 'reps', build: doubleProg,
    desc: 'En dan 3 × 6–8, drugi 3 × 10–12. Ko narediš vse serije na vrhu razpona, +2,5 kg. Test: ponovitve pri isti teži.' },
  { key: 'pause', group: 'method', name: 'Pavzirani bench + tempo', weeks: 6, test: '1rm', build: paused,
    desc: 'Pavza 2 s na prsih (moč iz spodnjega dela) in počasen spust (kontrola). Na koncu test 1RM z običajnim benchem.' }
];

export function programByKey(key) { return PROGRAMS.find(p => p.key === key) || null; }

// Reps test weight: 85 % of the 1RM the program started with.
export function repsTestKg(basis) { return r25(basis * 0.85); }

// ---- state ------------------------------------------------------------------

export function experimentOf(data) {
  if (!data.experiment) data.experiment = { oneRm: 110, active: null, history: [] };
  return data.experiment;
}

function benchOf(w) { return (w.exercises || []).find(e => isBench(e.name)); }

// Program sessions already done: [{ idx, workout, ex }] in order.
export function doneSessions(data, programId) {
  const out = [];
  for (const w of data.workouts) {
    for (const ex of w.exercises || []) {
      if (ex.program && ex.program.id === programId) out.push({ idx: ex.program.idx, workout: w, ex });
    }
  }
  return out.sort((a, b) => a.idx - b.idx || a.workout.dateISO.localeCompare(b.workout.dateISO));
}

function sessionsThisWeek(data, programId, now) {
  const from = isoDate(startOfWeek(now)), to = isoDate(addDays(startOfWeek(now), 6));
  return doneSessions(data, programId).filter(d => d.workout.dateISO >= from && d.workout.dateISO <= to);
}

// ---- plans ------------------------------------------------------------------

function warmups(firstKg) {
  const out = [];
  if (firstKg >= 45) out.push({ kg: 20, reps: 10 });
  for (const [f, reps] of [[0.5, 5], [0.7, 3], [0.85, 2]]) {
    const kg = r25(firstKg * f);
    if (kg > 20 && kg < firstKg - 2.5 && !out.some(o => o.kg === kg)) out.push({ kg, reps });
  }
  return out.map(o => ({ ...o, working: false, label: 'ogrevanje' }));
}

function workingSetsOf(ex) {
  const sets = (ex.sets || []).map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })).filter(s => s.reps > 0);
  const top = Math.max(0, ...sets.map(s => s.kg));
  return sets.filter(s => s.kg === top);
}

// Weight and reps for a double-progression session, from the last one of the same kind.
function dpTargets(data, active, idx, sess) {
  const prog = programByKey(active.key);
  const all = prog.build();
  const prev = doneSessions(data, active.id).filter(d => d.idx < idx && all[d.idx] && all[d.idx].key === sess.key).pop();
  const { sets, min, max } = sess.dp;
  if (!prev) return { kg: f25(active.basis * sess.dp.startPct / 100), reps: Array(sets).fill(min), why: 'Prvi trening te vrste.' };
  const ws = workingSetsOf(prev.ex);
  if (!ws.length) return { kg: f25(active.basis * sess.dp.startPct / 100), reps: Array(sets).fill(min), why: '' };
  const kg = ws[0].kg;
  const reps = Array.from({ length: sets }, (_, i) => (ws[i] ? ws[i].reps : 0));
  if (reps.every(r => r >= max)) return { kg: kg + 2.5, reps: Array(sets).fill(min), why: `Zadnjič ${sets} × ${max} — dvigni na ${fmtKg(kg + 2.5)} kg.`, up: true };
  return { kg, reps: reps.map(r => Math.max(min, Math.min(max, r + 1))), why: `Zadnjič ${fmtKg(kg)} kg × ${reps.filter(Boolean).join(', ')} — ista teža, ponovitev več.` };
}

// Earlier sessions of the same kind in this program, oldest first.
function prevSame(data, active, idx, key) {
  const all = programByKey(active.key).build();
  return doneSessions(data, active.id).filter(d => d.idx < idx && all[d.idx] && all[d.idx].key === key);
}

const fiveRm = basis => basis / (1 + 5 / 30);
const repsAtLeast = (ex, kg) => setsOf(ex).filter(s => s.kg >= kg - 0.01);

// Working sets with the last one "+" (as many as possible, typed in).
function amrapRows(kg, sets, reps) {
  return Array.from({ length: sets }, (_, i) => (i === sets - 1
    ? { kg, reps, working: true, label: `${reps}+ (do odpovedi)`, amrap: true, confirm: true }
    : { kg, reps, working: true }));
}

const RULES = {
  // GZCLP T1: 5 × 3+ → 6 × 2+ → 10 × 1+ at the same weight on a miss; then
  // start again at 85 %. Many reps on the last set → bigger jump.
  gzT1(data, active, idx) {
    const SCH = [[5, 3], [6, 2], [10, 1]];
    let kg = f25(fiveRm(active.basis) * 0.85), st = 0, why = 'Začetek: približno 85 % tvojega 5RM.';
    for (const d of prevSame(data, active, idx, 'A')) {
      const [n, r] = SCH[st];
      const sets = repsAtLeast(d.ex, kg);
      const total = sets.reduce((a, x) => a + x.reps, 0);
      const last = sets.length ? sets[sets.length - 1].reps : 0;
      if (total >= n * r) {
        const add = st === 0 && last >= 10 ? 5 : 2.5;
        why = `Zadnjič ${n} × ${r}+ uspešno${add > 2.5 ? ` (zadnja serija ${last})` : ''} — +${fmtKg(add)} kg.`;
        kg += add;
      } else if (st < 2) {
        why = `Zadnjič ${n} × ${r} ni šlo (${total}/${n * r}) — ista teža, ${SCH[st + 1][0]} × ${SCH[st + 1][1]}+.`;
        st++;
      } else {
        const k = f25(kg * 0.85);
        why = `10 × 1 ni šlo — nov začetek: 5 × 3+ pri ${fmtKg(k)} kg.`;
        kg = k; st = 0;
      }
    }
    const [n, r] = SCH[st];
    return { rows: amrapRows(kg, n, r), title: `${n} × ${r}+ @ ${fmtKg(kg)} kg`, desc: `${why} Zadnja serija do odpovedi — vpiši, koliko si jih naredil.` };
  },
  // GZCLP T2: 3 × 10 → 3 × 8 → 3 × 6 at the same weight on a miss; then 3 × 10
  // again, a bit heavier than the last 3 × 10 start.
  gzT2(data, active, idx) {
    const SCH = [[3, 10], [3, 8], [3, 6]];
    let kg = f25(active.basis * 0.6), start = kg, st = 0, why = 'Začetek: približno 60 % 1RM.';
    for (const d of prevSame(data, active, idx, 'B')) {
      const [n, r] = SCH[st];
      const total = repsAtLeast(d.ex, kg).reduce((a, x) => a + x.reps, 0);
      if (total >= n * r) { why = `Zadnjič ${n} × ${r} uspešno — +2,5 kg.`; kg += 2.5; }
      else if (st < 2) { why = `Zadnjič ${n} × ${r} ni šlo — ista teža, ${SCH[st + 1][0]} × ${SCH[st + 1][1]}.`; st++; }
      else { start += 2.5; why = `3 × 6 ni šlo — spet 3 × 10 pri ${fmtKg(start)} kg.`; kg = start; st = 0; }
    }
    const [n, r] = SCH[st];
    return { rows: Array.from({ length: n }, () => ({ kg, reps: r, working: true })), title: `${n} × ${r} @ ${fmtKg(kg)} kg`, desc: why };
  },
  // Texas Method intensity day: 1 × 5 at a new best, +2,5 kg after every success.
  txI(data, active, idx) {
    const t = texasWeight(data, active, idx);
    return { rows: [{ kg: t.kg, reps: 5, working: true, label: 'nov rekord', confirm: true }], title: `1 × 5 @ ${fmtKg(t.kg)} kg`, desc: `${t.why} Vpiši, koliko ponovitev je šlo.` };
  },
  // Texas Method volume day: 5 × 5 at 90 % of this week's intensity weight.
  txV(data, active, idx) {
    const t = texasWeight(data, active, idx);
    const kg = r25(t.kg * 0.9);
    return { rows: Array.from({ length: 5 }, () => ({ kg, reps: 5, working: true })), title: `5 × 5 @ ${fmtKg(kg)} kg`, desc: `90 % teže dneva intenzivnosti (${fmtKg(t.kg)} kg).` };
  }
};

function texasWeight(data, active, idx) {
  let kg = f25(fiveRm(active.basis) * 0.98), why = 'Začetek: malo pod tvojim 5RM.';
  for (const d of prevSame(data, active, idx, 'I')) {
    const best = Math.max(0, ...repsAtLeast(d.ex, kg).map(x => x.reps));
    if (best >= 5) { why = `Zadnjič ${fmtKg(kg)} × 5 uspešno — +2,5 kg.`; kg += 2.5; }
    else why = `Zadnjič ${fmtKg(kg)} kg × ${best} — ista teža še enkrat.`;
  }
  return { kg, why };
}

// Rows for session idx of the active program: warm-ups, then working sets.
export function sessionPlan(data, active, idx) {
  const prog = programByKey(active.key);
  const sess = prog.build()[idx];
  if (!sess) return null;
  const basis = active.basis;
  if (sess.test === '1rm') {
    const warm = [[20, 10], [0.5, 5], [0.65, 3], [0.75, 2], [0.85, 1]].map(([f, reps]) => ({ kg: f > 1 ? f : r25(basis * f), reps, working: false, label: 'ogrevanje' }));
    const a1 = r25(basis * 0.95), a2 = Math.max(a1 + 2.5, r25(basis)), a3 = Math.max(a2 + 2.5, r25(basis * 1.03));
    // Attempts are only recorded when ticked or typed in (an attempt not taken must not count).
    const rows = [...warm, ...[a1, a2, a3].map((kg, i) => ({ kg, reps: 1, working: true, label: `${i + 1}. poskus`, confirm: true }))];
    return { sess, rows, title: `Test 1RM: ${fmtKg(a1)} → ${fmtKg(a2)} → ${fmtKg(a3)} kg`,
      desc: `Počitek med poskusi 3–5 min. 1. poskus mora iti zanesljivo. 3. poskus (nov rekord) samo, če je 2. šel gladko; sicer dodaj le 2,5 kg ali končaj.` };
  }
  if (sess.test === 'reps') {
    const kg = repsTestKg(basis);
    const first = sess.key === 'T' ? computeResult(data, active) : null;
    const target = first && first.before ? first.before + 1 : 8;
    const rows = [...warmups(kg), { kg, reps: target, working: true, label: 'do odpovedi', amrap: true, confirm: true }];
    if (sess.key === 'T0') rows.push(...Array(3).fill(0).map(() => ({ kg: r25(basis * 0.7), reps: 5, working: false, label: 'dodatno' })));
    return { sess, rows, title: `Test: ${fmtKg(kg)} kg × čim več ponovitev`,
      desc: `Ena serija do tehnične odpovedi (brez pomoči). ${sess.key === 'T0' ? 'Ista teža bo na koncu programa' : `Na začetku programa: ${first && first.before != null ? first.before + ' pon.' : '—'}`} — tako se vidi napredek.` };
  }
  if (sess.rule) {
    const t = RULES[sess.rule](data, active, idx, sess);
    return { sess, rows: [...warmups(t.rows[0].kg), ...t.rows], title: t.title, desc: t.desc };
  }
  if (sess.dp) {
    const t = dpTargets(data, active, idx, sess);
    const rows = [...warmups(t.kg), ...t.reps.map(r => ({ kg: t.kg, reps: r, working: true }))];
    const same = t.reps.every(r => r === t.reps[0]);
    return { sess, rows, up: !!t.up, title: same ? `${t.reps.length} × ${t.reps[0]} @ ${fmtKg(t.kg)} kg` : `${fmtKg(t.kg)} kg × ${t.reps.join(', ')}`, desc: t.why };
  }
  const work = [];
  for (const b of sess.blocks) {
    const kg = r25(basis * b.pct / 100 + (b.add || 0));
    for (let i = 0; i < b.sets; i++) {
      work.push(b.warm
        ? { kg, reps: b.reps, working: false, label: 'ogrevanje' }
        : { kg, reps: b.reps, working: true, label: b.amrap ? `${b.reps}+ (do odpovedi)` : '', amrap: !!b.amrap, confirm: !!b.amrap });
    }
  }
  const groups = sess.blocks.filter(b => !b.warm).map(b => {
    const kg = fmtKg(r25(basis * b.pct / 100 + (b.add || 0)));
    return b.sets > 1 ? `${b.sets} × ${b.reps} @ ${kg} kg` : `${kg} × ${b.reps}${b.amrap ? '+' : ''}`;
  });
  // Programs that write their own warm-up sets (Sheiko) only get the empty bar first.
  const own = sess.blocks.some(b => b.warm);
  const pre = own ? (work[0].kg >= 45 ? [{ kg: 20, reps: 10, working: false, label: 'ogrevanje' }] : []) : warmups(work[0].kg);
  return { sess, rows: [...pre, ...work], title: groups.join(', '),
    desc: sess.blocks.some(b => b.amrap) ? 'Zadnja serija (+) do tehnične odpovedi — vpiši, koliko si jih naredil.' : '' };
}

// The next session of the active program and whether it can be done now.
export function nextSession(data, now = new Date()) {
  const ex = experimentOf(data);
  const active = ex.active;
  if (!active) return null;
  const prog = programByKey(active.key);
  if (!prog) return null;
  const all = prog.build();
  const done = doneSessions(data, active.id);
  const idx = done.length ? done[done.length - 1].idx + 1 : 0;
  if (idx >= all.length) return null;
  const sess = all[idx];
  const week = Math.floor(idx / PER_WEEK) + 1;
  const weeks = Math.ceil(all.length / PER_WEEK);
  let blocked = null, warn = null;
  const thisWeek = sessionsThisWeek(data, active.id, now);
  if (thisWeek.length >= PER_WEEK) {
    blocked = `Ta teden sta oba bench treninga opravljena (${PER_WEEK}/${PER_WEEK}). Naslednji od ponedeljka.`;
  }
  const lastDone = done[done.length - 1];
  const todayIso = isoDate(now);
  if (!blocked && lastDone && lastDone.workout.dateISO === todayIso) blocked = 'Današnji bench trening je že opravljen.';
  if (!blocked && lastDone && Math.round((fromIso(todayIso) - fromIso(lastDone.workout.dateISO)) / 86400000) === 1) {
    warn = 'Včeraj je bil bench — priporočen je vsaj en dan premora.';
  }
  return { active, prog, idx, sess, total: all.length, week, weeks, done: done.length, thisWeek: thisWeek.length, blocked, warn };
}

// Suggestion card for Bench Press in a workout while a program runs.
export function experimentRec(data, now = new Date()) {
  const n = nextSession(data, now);
  if (!n) return null;
  const head = `${n.prog.name} · teden ${n.week}/${n.weeks}`;
  if (n.blocked) {
    return { type: 'hold', program: true, title: 'Danes brez programa', reason: n.blocked, last: head, plan: null, reps: [], kg: 0, blocked: true };
  }
  const plan = sessionPlan(data, n.active, n.idx);
  const working = plan.rows.filter(r => r.working);
  return {
    type: 'program', program: true, title: n.sess.test ? plan.title : `${n.sess.name}: ${plan.title}`, reason: plan.desc || `Trening ${n.idx + 1} od ${n.total}.`,
    last: head, note: n.warn, plan: plan.rows, kg: working.length ? working[0].kg : 0, reps: working.map(r => r.reps), idx: n.idx
  };
}

// ---- results ----------------------------------------------------------------

function setsOf(ex) { return (ex.sets || []).map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })).filter(s => s.reps > 0); }

// Result of a program: { kind: '1rm', kg } or { kind: 'reps', kg, before, after }.
export function computeResult(data, entry) {
  const prog = programByKey(entry.key);
  if (!prog) return null;
  const all = prog.build();
  const done = doneSessions(data, entry.id);
  if (prog.test === '1rm') {
    const t = done.find(d => all[d.idx] && all[d.idx].test === '1rm');
    if (!t) return entry.result || null;
    const kg = Math.max(0, ...setsOf(t.ex).map(s => s.kg));
    return kg ? { kind: '1rm', kg, before: entry.basis } : entry.result || null;
  }
  const kg = repsTestKg(entry.basis);
  const repsAt = d => (d ? Math.max(0, ...setsOf(d.ex).filter(s => s.kg >= kg - 0.01).map(s => s.reps)) : null);
  const t0 = done.find(d => all[d.idx] && all[d.idx].key === 'T0');
  const t1 = done.find(d => all[d.idx] && all[d.idx].key === 'T');
  if (!t0 && !t1) return entry.result || null;
  return { kind: 'reps', kg, before: repsAt(t0), after: repsAt(t1) };
}

export function resultText(r) {
  if (!r) return 'Brez rezultata';
  if (r.kind === '1rm') {
    const d = r.kg - (r.before || 0);
    return `1RM ${fmtKg(r.before)} → ${fmtKg(r.kg)} kg (${d >= 0 ? '+' : '−'}${fmtKg(Math.abs(d))} kg)`;
  }
  if (r.after == null) return `${fmtKg(r.kg)} kg: ${r.before ?? '—'} pon. na začetku`;
  const d = r.after - (r.before || 0);
  return `${fmtKg(r.kg)} kg: ${r.before ?? '—'} → ${r.after} pon. (${d >= 0 ? '+' : '−'}${Math.abs(d)})`;
}

// ---- actions ----------------------------------------------------------------

export function startProgram(data, key, oneRm, now = new Date()) {
  const ex = experimentOf(data);
  if (oneRm > 0) ex.oneRm = oneRm;
  ex.active = { id: 'p' + Date.now().toString(36), key, startISO: isoDate(now), basis: ex.oneRm };
}

export function stopProgram(data, now = new Date()) {
  const ex = experimentOf(data);
  if (!ex.active) return;
  const entry = { ...ex.active, endISO: isoDate(now), stopped: true };
  entry.result = computeResult(data, entry);
  ex.history.push(entry);
  ex.active = null;
}

// Called when a workout is finished: marks its bench press as the program's
// next session; finishing the last one closes the program with its result.
export function tagWorkout(data, workout, now = new Date()) {
  const ex = experimentOf(data);
  const bench = benchOf(workout);
  if (!ex.active || !bench || !bench.sets.length) return false;
  const n = nextSession(data, now);
  if (!n || n.blocked) return false;
  bench.program = { id: ex.active.id, idx: n.idx };
  if (n.idx === n.total - 1) {
    const entry = { ...ex.active, endISO: isoDate(now) };
    entry.result = computeResult(data, entry);
    ex.history.push(entry);
    if (entry.result && entry.result.kind === '1rm' && entry.result.kg > 0) ex.oneRm = entry.result.kg;
    ex.active = null;
  }
  return true;
}

// Program suggested next: the first one not done yet.
export function suggestedNext(data) {
  const doneKeys = new Set(experimentOf(data).history.filter(h => !h.stopped).map(h => h.key));
  return PROGRAMS.find(p => !doneKeys.has(p.key)) || PROGRAMS[0];
}
