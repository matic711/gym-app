// Full training programs (all muscle groups): one after another, each ending
// with a test week — 1RM on bench, squat, deadlift and overhead press — so
// programs can be compared over the years: strength per lift, bodyweight and
// progress photos. Workouts started from a program carry its prescription and
// are tagged with { id, idx } when finished.
import { isoDate, fromIso, addDays, startOfWeek } from './util.js';
import { EXERCISE_LIBRARY } from './exercises.js';
import { exerciseHistory } from './stats.js';
import { recommend } from './progression.js';
import { experimentOf } from './experiment.js';
import { sleepMinutes } from './analysis.js';
import { photoList } from './photos.js';

export const LIFTS = {
  bench: { name: 'Bench Press', label: 'Bench', upper: true },
  squat: { name: 'Squat', label: 'Počep', upper: false },
  deadlift: { name: 'Deadlift', label: 'Mrtvi dvig', upper: false },
  ohp: { name: 'Overhead Press', label: 'OHP', upper: true }
};
export const CORE = ['bench', 'squat', 'deadlift', 'ohp'];

const r25 = kg => Math.round(kg / 2.5) * 2.5;
const f25 = kg => Math.floor(kg / 2.5 + 1e-9) * 2.5;
export function fmtKg(kg) { return kg == null ? '—' : Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ','); }
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const fiveRm = oneRm => oneRm / (1 + 5 / 30);

export function muscleOf(name) {
  for (const g of EXERCISE_LIBRARY) if (g.exercises.some(e => same(e, name))) return g.group;
  return /deadlift/i.test(name) ? 'Hamstrings & Glutes' : '';
}

// ---- building blocks ------------------------------------------------------------

// Row of a percentage prescription: sets × reps at pct % of the lift's training max.
const row = (p, r, n = 1, o = {}) => ({ p, r, n, ...o });
// Percentage work on a lift (or a variant named `name`, loaded from the lift's max).
const P = (lift, rows, o = {}) => ({ kind: 'pct', lift, name: o.name || LIFTS[lift].name, rows, add: o.add || 0, warm: o.warm !== false });
// Double progression: sets × min–max reps, weight from the exercise's own history.
const D = (name, sets, min, max) => ({ kind: 'dp', name, sets, min, max });
// Progression rule that reads earlier sessions of the program (GZCLP, Texas Method).
const R = (rule, lift, o = {}) => ({ kind: 'rule', rule, lift, name: o.name || (lift ? LIFTS[lift].name : ''), ...o });
const T = lift => ({ kind: 'test', lift, name: LIFTS[lift].name });

const TEST_WEEK = [
  { name: 'Test: počep + OHP', test: true, ex: [T('squat'), T('ohp')] },
  { name: 'Test: bench + mrtvi dvig', test: true, ex: [T('bench'), T('deadlift')] }
];

// ---- programs ---------------------------------------------------------------------

// 5/3/1 Boring But Big: 4 days, two 4-week cycles (+2,5 kg upper / +5 kg lower
// on the training max for the second), BBB 5 × 10 at 50 % then 60 %.
function wendlerBBB() {
  const main = [
    [row(65, 5), row(75, 5), row(85, 5, 1, { amrap: true })],
    [row(70, 3), row(80, 3), row(90, 3, 1, { amrap: true })],
    [row(75, 5), row(85, 3), row(95, 1, 1, { amrap: true })],
    [row(40, 5), row(50, 5), row(60, 5)]
  ];
  const days = [
    ['ohp', 'OHP', D('Chin-ups', 5, 6, 10)],
    ['deadlift', 'Mrtvi dvig', D('Hanging Leg Raise', 5, 10, 15)],
    ['bench', 'Bench', D('One-arm Dumbbell Row', 5, 8, 12)],
    ['squat', 'Počep', D('Leg Curl', 5, 8, 12)]
  ];
  const s = [];
  for (let c = 0; c < 2; c++) {
    for (let w = 0; w < 4; w++) {
      for (const [lift, label, assist] of days) {
        const add = c * (LIFTS[lift].upper ? 2.5 : 5);
        const rows = [...main[w]];
        if (w < 3) rows.push(row(c ? 60 : 50, 10, 5, { label: 'BBB' }));
        s.push({ name: `${label} · ${w < 3 ? ['5+', '3+', '5/3/1+'][w] : 'razbremenitev'}`, ex: [P(lift, rows, { add }), ...(w < 3 ? [assist] : [])] });
      }
    }
  }
  return [...s, ...TEST_WEEK];
}

// GZCLP, 4 days: T1 5 × 3+ → 6 × 2+ → 10 × 1+, T2 3 × 10 → 3 × 8 → 3 × 6,
// T3 3 × 15+ (more weight once the last set reaches 25).
function gzclp() {
  const days = [
    ['A1', 'squat', 'bench', 'Lat Pulldown'],
    ['B1', 'ohp', 'deadlift', 'One-arm Dumbbell Row'],
    ['A2', 'bench', 'squat', 'Lat Pulldown'],
    ['B2', 'deadlift', 'ohp', 'One-arm Dumbbell Row']
  ];
  const s = [];
  for (let w = 0; w < 8; w++) {
    for (const [d, t1, t2, t3] of days) {
      s.push({ name: `${d} · T1 ${LIFTS[t1].label}, T2 ${LIFTS[t2].label}`, ex: [R('gz1', t1), R('gz2', t2), R('gz3', null, { name: t3 })] });
    }
  }
  return [...s, ...TEST_WEEK];
}

// nSuns 5/3/1 LP, 5 days: 9 sets of T1 and 8 sets of T2 from the training
// max; the "1+" set of each lift's main day decides next week's increase.
function nsuns() {
  const t1Heavy = (prog, last) => [row(75, 5), row(85, 3), row(95, 1, 1, { amrap: true, prog }), row(90, 3), row(85, 3), row(80, 3), row(75, 5), row(70, 5), row(65, last, 1, { amrap: true })];
  const t2 = (base) => [row(base, 6), row(base + 10, 5), row(base + 20, 3), row(base + 20, 5), row(base + 20, 7), row(base + 20, 4), row(base + 20, 6), row(base + 20, 8)];
  const days = [
    { name: 'Bench (volumen) + OHP', ex: [
      P('bench', [row(65, 8), row(75, 6), row(85, 4), row(85, 4), row(85, 4), row(80, 5), row(75, 6), row(70, 7), row(65, 8, 1, { amrap: true })]),
      P('ohp', t2(50), { warm: false }), D('Lat Pulldown', 3, 8, 12), D('Dumbbell Curl', 3, 8, 12)] },
    { name: 'Počep + sumo mrtvi', ex: [
      P('squat', t1Heavy(true, 5)), P('deadlift', t2(50), { name: 'Sumo Deadlift', warm: false }), D('Leg Curl', 3, 8, 12), D('Hanging Leg Raise', 3, 10, 15)] },
    { name: 'OHP + incline bench', ex: [
      P('ohp', t1Heavy(true, 5)), P('bench', t2(40), { name: 'Incline Bench Press' }), D('Lateral Raise', 3, 12, 20), D('Face Pull', 3, 12, 20)] },
    { name: 'Mrtvi dvig + front squat', ex: [
      P('deadlift', [row(75, 5), row(85, 3), row(95, 1, 1, { amrap: true, prog: true }), row(90, 3), row(85, 3), row(80, 3), row(75, 3), row(70, 3), row(65, 3, 1, { amrap: true })]),
      P('squat', t2(35), { name: 'Front Squat' }), D('Barbell Row', 3, 8, 12), D('Hanging Leg Raise', 3, 10, 15)] },
    { name: 'Bench (težko) + ozek bench', ex: [
      P('bench', [row(75, 5), row(85, 3), row(95, 1, 1, { amrap: true, prog: true }), row(90, 3), row(85, 5), row(80, 3), row(75, 5), row(70, 3), row(65, 5, 1, { amrap: true })]),
      P('bench', t2(40), { name: 'Close-grip Bench Press', warm: false }), D('Chin-ups', 3, 6, 10), D('Triceps Pushdown', 3, 10, 15)] }
  ];
  const s = [];
  for (let w = 0; w < 6; w++) for (const d of days) s.push(d);
  return [...s, ...TEST_WEEK];
}

// PHUL: 4 days, power and hypertrophy days; every exercise on double progression.
function phul() {
  const days = [
    { name: 'Zgornji del · moč', ex: [D('Bench Press', 4, 3, 5), D('Barbell Row', 4, 3, 5), D('Incline Dumbbell Press', 3, 6, 10), D('Lat Pulldown', 3, 6, 10), D('Overhead Press', 3, 5, 8), D('Barbell Curl', 3, 6, 10), D('Skullcrusher', 3, 6, 10)] },
    { name: 'Spodnji del · moč', ex: [D('Squat', 4, 3, 5), D('Deadlift', 3, 3, 5), D('Leg Press', 4, 10, 15), D('Leg Curl', 3, 6, 10), D('Standing Calf Raise', 4, 6, 10)] },
    { name: 'Zgornji del · hipertrofija', ex: [D('Incline Bench Press', 4, 8, 12), D('Dumbbell Fly', 3, 8, 12), D('Seated Cable Row', 4, 8, 12), D('One-arm Dumbbell Row', 3, 8, 12), D('Lateral Raise', 3, 8, 12), D('Dumbbell Curl', 3, 8, 12), D('Triceps Pushdown', 3, 8, 12)] },
    { name: 'Spodnji del · hipertrofija', ex: [D('Front Squat', 4, 8, 12), D('Lunges', 3, 8, 12), D('Leg Extension', 3, 10, 15), D('Leg Curl', 3, 10, 15), D('Seated Calf Raise', 4, 8, 12)] }
  ];
  const s = [];
  for (let w = 0; w < 8; w++) for (const d of days) s.push(d);
  return [...s, ...TEST_WEEK];
}

// Texas Method, 3 days: volume (5 × 5 at 90 %), recovery (light), intensity
// (1 × 5 at a new best). Bench and press take turns week by week.
function texasFull() {
  const s = [];
  for (let w = 0; w < 8; w++) {
    const main = w % 2 ? 'ohp' : 'bench', other = w % 2 ? 'bench' : 'ohp';
    s.push({ name: `Volumen · počep, ${LIFTS[main].label}, mrtvi`, ex: [R('txV', 'squat'), R('txV', main), R('txD', 'deadlift')] });
    s.push({ name: `Regeneracija · počep, ${LIFTS[other].label}`, ex: [R('txR', 'squat'), R('txR', other), D('Chin-ups', 3, 6, 10), D('Back Extension', 3, 10, 15)] });
    s.push({ name: `Intenzivnost · počep, ${LIFTS[main].label}`, ex: [R('txI', 'squat'), R('txI', main), D('Barbell Row', 3, 6, 10)] });
  }
  return [...s, ...TEST_WEEK];
}

// Sheiko-style squat, bench and deadlift, 3 days (bench twice a week).
// Pyramids at 50–85 %, rarely above 90 %; the 50–60 % sets are its warm-up.
function sheikoFull() {
  const W = (p, r, n = 1) => row(p, r, n, { warm: p <= 60 });
  const squat = [
    [W(50, 5), W(60, 4), W(70, 3, 2), W(75, 3, 4)], [W(50, 5), W(60, 4), W(70, 3), W(80, 2, 4)],
    [W(50, 5), W(60, 4), W(70, 3), W(80, 3, 2), W(85, 2, 2), W(80, 3)], [W(50, 5), W(60, 4), W(70, 3, 3)],
    [W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(85, 2, 3)], [W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(90, 1, 2), W(85, 2, 2)],
    [W(50, 3), W(60, 3), W(70, 3), W(80, 2, 3)], [W(50, 3), W(60, 3), W(70, 3, 2)]
  ];
  const squatB = [[W(50, 5), W(60, 5), W(70, 5, 4)], [W(50, 5), W(60, 5), W(70, 4, 4)], [W(55, 5), W(65, 4), W(75, 3, 4)], [W(50, 5), W(60, 5), W(65, 5, 3)],
    [W(50, 4), W(60, 4), W(70, 3, 4)], [W(50, 4), W(60, 3), W(75, 3, 3)], [W(50, 4), W(60, 3), W(70, 3, 3)], [W(50, 3), W(60, 3), W(65, 3, 2)]];
  const bench = [
    [W(50, 5), W(60, 4), W(70, 3, 2), W(75, 3, 5)], [W(50, 5), W(60, 4), W(70, 3), W(80, 2, 5)],
    [W(50, 5), W(60, 4), W(70, 3), W(80, 3, 2), W(85, 2, 3), W(80, 3, 2)], [W(50, 5), W(60, 4), W(70, 3, 2), W(75, 3, 4)],
    [W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(85, 2, 4)], [W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(90, 1, 3), W(85, 2, 2)],
    [W(50, 3), W(60, 3), W(70, 3), W(80, 2, 2), W(85, 2, 3)], [W(50, 3), W(60, 3), W(70, 3, 2), W(75, 2, 3)]
  ];
  const benchB = [[W(50, 6), W(60, 6), W(70, 6, 4)], [W(50, 5), W(60, 5), W(70, 4, 5)], [W(55, 5), W(65, 5), W(75, 4, 4)], [W(50, 6), W(60, 6), W(65, 6, 3)],
    [W(50, 5), W(60, 4), W(70, 3, 2), W(75, 3, 4)], [W(50, 5), W(60, 5), W(70, 4, 4)], [W(50, 5), W(60, 4), W(70, 3, 3)], [W(50, 4), W(60, 4), W(65, 3, 3)]];
  const dl = [
    [W(50, 3), W(60, 3), W(70, 3, 2), W(75, 3, 4)], [W(50, 3), W(60, 3), W(70, 3), W(80, 2, 4)],
    [W(50, 3), W(60, 3), W(70, 3), W(80, 3), W(85, 2, 3)], [W(50, 3), W(60, 3), W(70, 3, 3)],
    [W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(85, 2, 3)], [W(50, 3), W(60, 3), W(70, 3), W(80, 2), W(90, 1, 2)],
    [W(50, 3), W(60, 3), W(70, 3), W(80, 2, 3)], [W(50, 3), W(60, 3), W(70, 2, 3)]
  ];
  const s = [];
  for (let w = 0; w < 8; w++) {
    const phase = w < 4 ? 'pripravljalna' : 'tekmovalna';
    s.push({ name: `Počep + bench (${phase})`, ex: [P('squat', squat[w], { warm: false }), P('bench', bench[w], { warm: false }), D('Dumbbell Fly', 3, 8, 12)] });
    s.push({ name: `Mrtvi dvig (${phase})`, ex: [P('deadlift', dl[w], { warm: false }), D('Dips', 4, 6, 10), D('Good Morning', 3, 6, 10)] });
    s.push({ name: `Počep + bench, volumen (${phase})`, ex: [P('squat', squatB[w], { warm: false }), P('bench', benchB[w], { warm: false }), D('Triceps Pushdown', 3, 10, 15)] });
  }
  return [...s, ...TEST_WEEK];
}

// Specialisation blocks: roughly twice the usual volume for one muscle group,
// the rest on maintenance; everything on double progression.
function spec(days, weeks = 6) {
  const s = [];
  for (let w = 0; w < weeks; w++) for (const d of days) s.push(d);
  return [...s, ...TEST_WEEK];
}

function backSpec() {
  return spec([
    { name: 'Zgoraj A · hrbet', ex: [D('Pull-ups', 4, 6, 10), D('Barbell Row', 3, 6, 10), D('Bench Press', 3, 5, 8), D('Overhead Press', 2, 6, 10), D('Face Pull', 2, 12, 20)] },
    { name: 'Spodaj A', ex: [D('Squat', 3, 5, 8), D('Romanian Deadlift', 3, 6, 10), D('Lat Pulldown', 3, 10, 15), D('Leg Curl', 2, 10, 15)] },
    { name: 'Zgoraj B · hrbet', ex: [D('Seated Cable Row', 3, 8, 12), D('Chin-ups', 3, 6, 10), D('Incline Dumbbell Press', 3, 8, 12), D('Lateral Raise', 2, 12, 20), D('One-arm Dumbbell Row', 3, 8, 12)] },
    { name: 'Spodaj B', ex: [D('Deadlift', 3, 3, 5), D('Leg Press', 3, 10, 15), D('T-Bar Row', 3, 8, 12), D('Straight-arm Pulldown', 2, 12, 15)] }
  ]);
}
function shoulderSpec() {
  return spec([
    { name: 'Zgoraj A · ramena', ex: [D('Overhead Press', 4, 5, 8), D('Bench Press', 3, 5, 8), D('Barbell Row', 3, 6, 10), D('Lateral Raise', 4, 12, 20), D('Rear Delt Fly', 3, 12, 20)] },
    { name: 'Spodaj A', ex: [D('Squat', 3, 5, 8), D('Romanian Deadlift', 3, 6, 10), D('Lateral Raise', 3, 12, 20), D('Leg Curl', 2, 10, 15)] },
    { name: 'Zgoraj B · ramena', ex: [D('Dumbbell Shoulder Press', 4, 8, 12), D('Incline Dumbbell Press', 3, 8, 12), D('Lat Pulldown', 3, 8, 12), D('Lateral Raise', 4, 12, 20), D('Face Pull', 3, 12, 20)] },
    { name: 'Spodaj B', ex: [D('Deadlift', 3, 3, 5), D('Leg Press', 3, 10, 15), D('Lateral Raise', 3, 12, 20), D('Rear Delt Fly', 2, 12, 20)] }
  ]);
}
function armSpec() {
  return spec([
    { name: 'Zgoraj A · roke', ex: [D('Bench Press', 3, 5, 8), D('Barbell Row', 3, 6, 10), D('Barbell Curl', 4, 8, 12), D('Skullcrusher', 4, 8, 12)] },
    { name: 'Spodaj A + roke', ex: [D('Squat', 3, 5, 8), D('Romanian Deadlift', 3, 6, 10), D('Hammer Curl', 3, 10, 15), D('Triceps Pushdown', 3, 10, 15)] },
    { name: 'Zgoraj B · roke', ex: [D('Close-grip Bench Press', 4, 6, 10), D('Chin-ups', 3, 6, 10), D('Overhead Press', 2, 6, 10), D('Dumbbell Curl', 4, 8, 12), D('Overhead Triceps Extension', 3, 10, 15)] },
    { name: 'Spodaj B + roke', ex: [D('Deadlift', 3, 3, 5), D('Leg Press', 3, 10, 15), D('Preacher Curl', 3, 10, 15), D('Dips', 3, 8, 12)] }
  ]);
}
function legSpec() {
  const heavy = [[5, 5, 72.5], [5, 5, 75], [5, 5, 77.5], [5, 3, 80], [5, 3, 82.5], [5, 3, 85]];
  const volume = [[4, 8, 62.5], [4, 8, 65], [4, 8, 67.5], [4, 6, 70], [4, 6, 72.5], [3, 6, 65]];
  const s = [];
  for (let w = 0; w < 6; w++) {
    s.push({ name: 'Noge · težko', ex: [P('squat', [row(heavy[w][2], heavy[w][1], heavy[w][0])]), D('Romanian Deadlift', 3, 6, 10), D('Leg Curl', 3, 10, 15), D('Standing Calf Raise', 4, 8, 12)] });
    s.push({ name: 'Zgoraj A', ex: [D('Bench Press', 3, 5, 8), D('Barbell Row', 3, 6, 10), D('Overhead Press', 2, 6, 10), D('Lat Pulldown', 2, 8, 12)] });
    s.push({ name: 'Noge · volumen', ex: [P('squat', [row(volume[w][2], volume[w][1], volume[w][0])]), D('Bulgarian Split Squat', 3, 8, 12), D('Leg Extension', 3, 10, 15), D('Seated Calf Raise', 4, 10, 15)] });
    s.push({ name: 'Zgoraj B', ex: [D('Incline Dumbbell Press', 3, 8, 12), D('Pull-ups', 3, 6, 10), D('Lateral Raise', 2, 12, 20), D('Dumbbell Curl', 2, 10, 12)] });
    s.push({ name: 'Noge · tehnika', ex: [P('squat', [row(70, 2, 6)]), D('Leg Press', 3, 10, 15), D('Hip Thrust', 3, 8, 12)] });
  }
  return [...s, ...TEST_WEEK];
}

export const FULL_PROGRAMS = [
  { key: 'bbb', group: 'full', name: '5/3/1 Boring But Big', days: 4, weeks: 9, tm: 0.9, build: wendlerBBB,
    origin: 'Jim Wendler',
    desc: 'Vsak dan en glavni dvig po 5/3/1 (zadnja serija do odpovedi) in 5 × 10 istega dviga, plus ena pomožna vaja. Dva cikla, trening maks +2,5 kg zgoraj / +5 kg spodaj.' },
  { key: 'gzclp', group: 'full', name: 'GZCLP', days: 4, weeks: 9, tm: 1, build: gzclp,
    origin: 'Cody Lefever (GZCL)',
    desc: 'T1 težko (5 × 3+), T2 volumen (3 × 10), T3 pomožna (3 × 15+). Ko ne gre, se shema spremeni (6 × 2+, 10 × 1+ …) — teže sledijo tvojim rezultatom.' },
  { key: 'nsuns', group: 'full', name: 'nSuns 5/3/1 LP (5 dni)', days: 5, weeks: 7, tm: 0.9, dynamic: 'nsuns', build: nsuns,
    origin: 'nSuns (Reddit), 5-dnevna različica',
    desc: 'Veliko volumna: 9 serij glavnega dviga + 8 serij drugega. Serija »1+« vsak teden določi, za koliko se dvigne trening maks.' },
  { key: 'phul', group: 'full', name: 'PHUL', days: 4, weeks: 9, tm: 1, build: phul,
    origin: 'Brandon Campbell',
    desc: 'Zgornji/spodnji del, dva dneva moči (3–5 pon.) in dva hipertrofije (8–15 pon.). Vse vaje na double progression.' },
  { key: 'texas', group: 'power', name: 'Texas Method', days: 3, weeks: 9, tm: 1, build: texasFull,
    origin: 'Mark Rippetoe / Glenn Pendlay',
    desc: 'Ponedeljek volumen (5 × 5 pri 90 %), sreda lahko, petek nov 5RM. Bench in OHP se izmenjujeta po tednih, mrtvi 1 × 5 enkrat na teden.' },
  { key: 'sheikofull', group: 'power', name: 'Sheiko: počep, bench, mrtvi', days: 3, weeks: 9, tm: 1, build: sheikoFull,
    origin: 'V slogu Borisa Šejka · bench prilagojen na 2× na teden',
    desc: 'Piramide pri 70–85 % z veliko serijami po 2–5 ponovitev, redko nad 90 %. 4 tedne pripravljalne in 4 tedne tekmovalne faze.' },
  { key: 'spec-back', group: 'spec', name: 'Specializacija: hrbet', days: 4, weeks: 7, tm: 1, build: backSpec,
    origin: 'Lastna zasnova · ~20 serij za hrbet na teden, ostalo vzdrževanje',
    desc: 'Zgoraj/spodaj 4 dni, hrbet v vsakem treningu (vleke, veslanja). Ostale skupine 2–3 serije za vzdrževanje.' },
  { key: 'spec-shoulders', group: 'spec', name: 'Specializacija: ramena', days: 4, weeks: 7, tm: 1, build: shoulderSpec,
    origin: 'Lastna zasnova · stranske rame 4× na teden',
    desc: 'OHP in potisk z ročkami 2× na teden, stranski dvigi v vsakem treningu, zadnje rame 2×.' },
  { key: 'spec-arms', group: 'spec', name: 'Specializacija: roke', days: 4, weeks: 7, tm: 1, build: armSpec,
    origin: 'Lastna zasnova · biceps in triceps v vsakem treningu',
    desc: 'Pregibi in iztegi v vsakem treningu (~14 serij vsak na teden), ozek bench in dipi za triceps.' },
  { key: 'spec-legs', group: 'spec', name: 'Specializacija: noge (počep)', days: 5, weeks: 7, tm: 1, build: legSpec,
    origin: 'Lastna zasnova · počep 3× na teden',
    desc: 'Počep težko, volumen in tehnika (3× na teden, iz 1RM), plus pomožne za noge. Zgornji del 2× za vzdrževanje.' }
];

export const GROUPS = [['full', 'Celotni programi'], ['power', 'Moč: počep, bench, mrtvi'], ['spec', 'Specializacije']];
export function fullProgramByKey(key) { return FULL_PROGRAMS.find(p => p.key === key) || null; }

// ---- state ------------------------------------------------------------------------

export function programsOf(data) {
  if (!data.programs) data.programs = { oneRm: {}, active: null, history: [] };
  return data.programs;
}

export function getOneRm(data, lift) {
  if (lift === 'bench') return experimentOf(data).oneRm;
  const v = programsOf(data).oneRm[lift];
  return v > 0 ? v : null;
}

export function setOneRm(data, lift, kg) {
  if (!(kg > 0)) return;
  if (lift === 'bench') experimentOf(data).oneRm = kg;
  else programsOf(data).oneRm[lift] = kg;
}

// A starting point from the last half year of training (best set, Epley).
export function estimateOneRm(data, lift, now = new Date()) {
  const from = isoDate(addDays(now, -183));
  let best = 0;
  for (const h of exerciseHistory(data, LIFTS[lift].name)) {
    if (h.dateISO < from) continue;
    for (const s of h.sets) {
      const kg = Number(s.kg) || 0, reps = Number(s.reps) || 0;
      if (kg > 0 && reps >= 1 && reps <= 10) best = Math.max(best, reps === 1 ? kg : kg * (1 + reps / 30));
    }
  }
  return best ? f25(best) : null;
}

// Workouts of a program: [{ idx, workout }] in order.
export function programWorkouts(data, id) {
  return data.workouts.filter(w => w.program && w.program.id === id)
    .map(w => ({ idx: w.program.idx, workout: w }))
    .sort((a, b) => a.idx - b.idx || a.workout.dateISO.localeCompare(b.workout.dateISO));
}

function exOf(workout, name) { return (workout.exercises || []).find(e => same(e.name, name)); }
function setsOf(ex) { return ex ? ex.sets.map(s => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })).filter(s => s.reps > 0) : []; }
const atLeast = (ex, kg) => setsOf(ex).filter(s => s.kg >= kg - 0.01);
const inc = (lift, upper = 2.5, lower = 5) => (LIFTS[lift] && !LIFTS[lift].upper ? lower : upper);

// ---- prescriptions ------------------------------------------------------------------

function warmups(firstKg) {
  if (!(firstKg > 0)) return [];
  const out = [];
  if (firstKg >= 45) out.push({ kg: 20, reps: 10 });
  for (const [f, reps] of [[0.5, 5], [0.7, 3], [0.85, 2]]) {
    const kg = r25(firstKg * f);
    if (kg > 20 && kg < firstKg - 2.5 && !out.some(o => o.kg === kg)) out.push({ kg, reps });
  }
  return out.map(o => ({ ...o, working: false, label: 'ogrevanje' }));
}

const groupTitle = rows => {
  const work = rows.filter(x => x.working);
  if (work.length && work.every(x => x.kg == null)) {
    const amrap = work.some(x => x.amrap);
    return `${work.length} × ${work[0].reps}${amrap ? '+' : ''} · izberi težo`;
  }
  const out = [];
  for (const r of rows.filter(x => x.working)) {
    const last = out[out.length - 1];
    if (last && last.kg === r.kg && last.reps === r.reps && !r.amrap && !last.amrap) last.n++;
    else out.push({ kg: r.kg, reps: r.reps, n: 1, amrap: r.amrap });
  }
  return out.map(g => (g.n > 1 ? `${g.n} × ${g.reps} @ ${fmtKg(g.kg)}` : `${fmtKg(g.kg)} × ${g.reps}${g.amrap ? '+' : ''}`)).join(', ') + ' kg';
};

// Training max of a lift at session idx (nSuns raises it from the "1+" sets).
function tmAt(data, active, prog, lift, idx, memo = new Map()) {
  const key = lift + ':' + idx;
  if (memo.has(key)) return memo.get(key);
  let tm = (active.oneRm[lift] || 0) * prog.tm;
  if (prog.dynamic === 'nsuns') {
    const all = sessionsOf(active);
    for (const d of programWorkouts(data, active.id)) {
      if (d.idx >= idx) break;
      const sess = all[d.idx];
      const e = sess && sess.ex.find(x => x.kind === 'pct' && x.lift === lift && x.rows.some(r => r.prog));
      if (!e) continue;
      const r = e.rows.find(x => x.prog);
      const kg = r25(tmAt(data, active, prog, lift, d.idx, memo) * r.p / 100);
      const reps = Math.max(0, ...atLeast(exOf(d.workout, e.name), kg).filter(s => s.kg <= kg + 0.01).map(s => s.reps));
      tm += reps >= 6 ? inc(lift, 5, 7.5) : reps >= 4 ? inc(lift, 2.5, 5) : reps >= 2 ? 2.5 : 0;
    }
  }
  memo.set(key, tm);
  return tm;
}

function prevWith(data, active, idx, pred) {
  const all = sessionsOf(active);
  return programWorkouts(data, active.id).filter(d => d.idx < idx && all[d.idx] && all[d.idx].ex.some(pred))
    .map(d => ({ ...d, e: all[d.idx].ex.find(pred) }));
}

const amrapRows = (kg, n, reps) => Array.from({ length: n }, (_, i) => (i === n - 1
  ? { kg, reps, working: true, label: `${reps}+ (do odpovedi)`, amrap: true, confirm: true }
  : { kg, reps, working: true }));

const RULES = {
  // GZCLP T1: 5 × 3+ → 6 × 2+ → 10 × 1+ at the same weight on a miss, then 85 %.
  gz1(data, active, idx, e) {
    const SCH = [[5, 3], [6, 2], [10, 1]];
    let kg = f25(fiveRm(active.oneRm[e.lift] || 0) * 0.85), st = 0, why = 'Začetek: ~85 % tvojega 5RM.';
    for (const d of prevWith(data, active, idx, x => x.rule === 'gz1' && x.lift === e.lift)) {
      const [n, r] = SCH[st];
      const sets = atLeast(exOf(d.workout, e.name), kg);
      const total = sets.reduce((a, x) => a + x.reps, 0);
      if (total >= n * r) { why = `Zadnjič ${n} × ${r}+ uspešno — +${fmtKg(inc(e.lift))} kg.`; kg += inc(e.lift); }
      else if (st < 2) { why = `Zadnjič ${n} × ${r} ni šlo — ista teža, ${SCH[st + 1][0]} × ${SCH[st + 1][1]}+.`; st++; }
      else { kg = f25(kg * 0.85); st = 0; why = `10 × 1 ni šlo — nov začetek pri ${fmtKg(kg)} kg.`; }
    }
    const [n, r] = SCH[st];
    return { rows: [...warmups(kg), ...amrapRows(kg, n, r)], desc: `T1 · ${why}` };
  },
  // GZCLP T2: 3 × 10 → 3 × 8 → 3 × 6, then 3 × 10 slightly heavier than the last start.
  gz2(data, active, idx, e) {
    const SCH = [[3, 10], [3, 8], [3, 6]];
    let kg = f25((active.oneRm[e.lift] || 0) * 0.6), start = kg, st = 0, why = 'Začetek: ~60 % 1RM.';
    for (const d of prevWith(data, active, idx, x => x.rule === 'gz2' && x.lift === e.lift)) {
      const [n, r] = SCH[st];
      const total = atLeast(exOf(d.workout, e.name), kg).reduce((a, x) => a + x.reps, 0);
      if (total >= n * r) { why = `Zadnjič ${n} × ${r} uspešno — +${fmtKg(inc(e.lift))} kg.`; kg += inc(e.lift); }
      else if (st < 2) { why = `Zadnjič ${n} × ${r} ni šlo — ista teža, ${SCH[st + 1][0]} × ${SCH[st + 1][1]}.`; st++; }
      else { start += inc(e.lift); kg = start; st = 0; why = `3 × 6 ni šlo — spet 3 × 10 pri ${fmtKg(kg)} kg.`; }
    }
    const [n, r] = SCH[st];
    return { rows: Array.from({ length: n }, () => ({ kg, reps: r, working: true })), desc: `T2 · ${why}` };
  },
  // GZCLP T3: 3 × 15+, more weight once the last set reaches 25.
  gz3(data, active, idx, e) {
    const prev = prevWith(data, active, idx, x => x.rule === 'gz3' && same(x.name, e.name));
    let kg = null, why = 'Prvič: teža, s katero narediš ~20 ponovitev.';
    const hist = exerciseHistory(data, e.name).filter(h => h.dateISO < active.startISO);
    if (hist.length) kg = hist[hist.length - 1].topKg || null;
    for (const d of prev) {
      const sets = setsOf(exOf(d.workout, e.name));
      if (!sets.length) continue;
      const top = Math.max(...sets.map(s => s.kg));
      const last = sets.filter(s => s.kg === top).pop();
      kg = top;
      if (last.reps >= 25) { kg = top + 2.5; why = `Zadnja serija ${last.reps} — +2,5 kg.`; } else why = `Zadnja serija ${last.reps} — ista teža, cilj 25.`;
    }
    return { rows: amrapRows(kg, 3, 15), desc: `T3 · ${why}` };
  },
  // Texas Method: volume 5 × 5 at 90 % of the intensity weight.
  txV(data, active, idx, e) {
    const t = texasI(data, active, idx, e.lift);
    const kg = r25(t.kg * 0.9);
    return { rows: [...warmups(kg), ...Array.from({ length: 5 }, () => ({ kg, reps: 5, working: true }))], desc: `90 % teže petka (${fmtKg(t.kg)} kg).` };
  },
  // Recovery day: squat 2 × 5 at 80 % of Monday, upper body 3 × 5 lighter.
  txR(data, active, idx, e) {
    const t = texasI(data, active, idx, e.lift);
    const kg = r25(t.kg * (e.lift === 'squat' ? 0.72 : 0.81));
    const n = e.lift === 'squat' ? 2 : 3;
    return { rows: [...warmups(kg), ...Array.from({ length: n }, () => ({ kg, reps: 5, working: true }))], desc: 'Lahek dan za regeneracijo.' };
  },
  // Intensity day: 1 × 5 at a new best.
  txI(data, active, idx, e) {
    const t = texasI(data, active, idx, e.lift);
    return { rows: [...warmups(t.kg), { kg: t.kg, reps: 5, working: true, label: 'nov rekord', confirm: true }], desc: t.why };
  },
  // Deadlift 1 × 5 on the volume day, +2,5 kg after each success.
  txD(data, active, idx, e) {
    let kg = f25(fiveRm(active.oneRm.deadlift || 0) * 0.9), why = 'Začetek: malo pod 5RM.';
    for (const d of prevWith(data, active, idx, x => x.rule === 'txD')) {
      const best = Math.max(0, ...atLeast(exOf(d.workout, e.name), kg).map(s => s.reps));
      if (best >= 5) { kg += 2.5; why = 'Zadnjič 1 × 5 uspešno — +2,5 kg.'; } else why = 'Zadnjič manj kot 5 — ista teža.';
    }
    return { rows: [...warmups(kg), { kg, reps: 5, working: true, label: '1 × 5', confirm: true }], desc: why };
  }
};

function texasI(data, active, idx, lift) {
  let kg = f25(fiveRm(active.oneRm[lift] || 0) * 0.95), why = 'Začetek: malo pod tvojim 5RM.';
  for (const d of prevWith(data, active, idx, x => x.rule === 'txI' && x.lift === lift)) {
    const best = Math.max(0, ...atLeast(exOf(d.workout, LIFTS[lift].name), kg).map(s => s.reps));
    if (best >= 5) { why = `Zadnjič ${fmtKg(kg)} × 5 — +2,5 kg.`; kg += 2.5; } else why = `Zadnjič ${fmtKg(kg)} kg × ${best} — ista teža še enkrat.`;
  }
  return { kg, why };
}

export function sessionsOf(entry) {
  const prog = fullProgramByKey(entry.key);
  return prog ? prog.build() : [];
}

// Prescription of session idx: [{ name, muscle, rows, title, desc }].
export function sessionPrescription(data, active, idx, now = new Date()) {
  const prog = fullProgramByKey(active.key);
  const sess = sessionsOf(active)[idx];
  if (!prog || !sess) return null;
  const memo = new Map();
  const exercises = sess.ex.map(e => {
    let rows, desc = '', title;
    if (e.kind === 'pct') {
      const tm = tmAt(data, active, prog, e.lift, idx, memo);
      const work = [];
      for (const r of e.rows) {
        const kg = r25(tm * r.p / 100 + (e.add || 0));
        for (let i = 0; i < r.n; i++) {
          work.push(r.warm ? { kg, reps: r.r, working: false, label: 'ogrevanje' }
            : { kg, reps: r.r, working: true, label: r.amrap ? `${r.r}+ (do odpovedi)` : r.label || '', amrap: !!r.amrap, confirm: !!r.amrap });
        }
      }
      const firstWork = work.find(x => x.working);
      rows = [...(e.warm && firstWork ? warmups(firstWork.kg) : []), ...work];
      desc = e.rows.some(r => r.amrap) ? 'Serije »+« do tehnične odpovedi — vpiši, koliko si jih naredil.' : '';
      if (prog.tm < 1) desc = `Trening maks ${fmtKg(r25(tm + (e.add || 0)))} kg. ${desc}`.trim();
    } else if (e.kind === 'rule') {
      const t = RULES[e.rule](data, active, idx, e);
      rows = t.rows; desc = t.desc;
    } else if (e.kind === 'dp') {
      const rec = recommend(data, e.name, now, { sets: e.sets, min: e.min, max: e.max });
      const coreLift = CORE.find(l => same(LIFTS[l].name, e.name));
      if (rec && rec.plan) {
        rows = rec.plan; desc = rec.reason; title = `${rec.title}`;
      } else if (coreLift && active.oneRm[coreLift] > 0) {
        // No history yet for a main lift: start from the 1RM, ~2 reps in reserve.
        const kg = f25(active.oneRm[coreLift] / (1 + (e.min + 2) / 30));
        rows = [...warmups(kg), ...Array.from({ length: e.sets }, () => ({ kg, reps: e.min, working: true }))];
        desc = `Začetek iz 1RM (${fmtKg(active.oneRm[coreLift])} kg).`;
        title = `${e.sets} × ${e.min} @ ${fmtKg(kg)} kg`;
      } else {
        rows = Array.from({ length: e.sets }, () => ({ kg: null, reps: e.min, working: true }));
        desc = `Prvič: izberi težo, s katero narediš ~${e.min + 2} ponovitev.`;
        title = `${e.sets} × ${e.min}–${e.max}`;
      }
      title = title || `${e.sets} × ${e.min}–${e.max}`;
      desc = `${e.sets} × ${e.min}–${e.max} · ${desc}`;
    } else if (e.kind === 'test') {
      const base = active.oneRm[e.lift];
      if (base > 0) {
        const a1 = r25(base * 0.95), a2 = Math.max(a1 + 2.5, r25(base)), a3 = Math.max(a2 + 2.5, r25(base * 1.03));
        rows = [...[[20, 10], [0.5, 5], [0.65, 3], [0.75, 2], [0.85, 1]].map(([f, reps]) => ({ kg: f > 1 ? f : r25(base * f), reps, working: false, label: 'ogrevanje' })),
          ...[a1, a2, a3].map((kg, i) => ({ kg, reps: 1, working: true, label: `${i + 1}. poskus`, confirm: true }))];
        title = `Test 1RM: ${fmtKg(a1)} → ${fmtKg(a2)} → ${fmtKg(a3)} kg`;
      } else {
        rows = [1, 2, 3].map(i => ({ kg: null, reps: 1, working: true, label: `${i}. poskus`, confirm: true }));
        title = 'Test 1RM: poišči maks';
      }
      desc = 'Počitek med poskusi 3–5 min. 3. poskus samo, če je 2. šel gladko.';
    }
    return { name: e.name, muscle: muscleOf(e.name), kind: e.kind, lift: e.lift, rows, desc, title: title || groupTitle(rows) };
  });
  return { prog, sess, exercises };
}

// ---- progress through the program ---------------------------------------------------

export function nextFullSession(data, now = new Date()) {
  const st = programsOf(data);
  const active = st.active;
  if (!active) return null;
  const prog = fullProgramByKey(active.key);
  if (!prog) return null;
  const all = sessionsOf(active);
  const done = programWorkouts(data, active.id);
  const idx = done.length ? done[done.length - 1].idx + 1 : 0;
  if (idx >= all.length) return null;
  const sess = all[idx];
  const trainingCount = all.length - TEST_WEEK.length;
  const week = idx >= trainingCount ? prog.weeks : Math.floor(idx / prog.days) + 1;
  const from = isoDate(startOfWeek(now)), to = isoDate(addDays(startOfWeek(now), 6));
  const thisWeek = done.filter(d => d.workout.dateISO >= from && d.workout.dateISO <= to).length;
  const todayIso = isoDate(now);
  let blocked = null;
  if (thisWeek >= prog.days) blocked = `Ta teden je opravljenih vseh ${prog.days} treningov programa. Naslednji od ponedeljka.`;
  else if (done.some(d => d.workout.dateISO === todayIso)) blocked = 'Današnji trening programa je že opravljen.';
  return { prog, active, idx, sess, total: all.length, week, weeks: prog.weeks, done: done.length, thisWeek, blocked, test: !!sess.test };
}

// The workout for the next session, ready for NovTrening.
export function workoutForSession(data, n, uid) {
  const pr = sessionPrescription(data, n.active, n.idx);
  return {
    id: uid(), name: `${n.prog.name} · ${n.sess.name}`, startedAt: Date.now(),
    programSession: { id: n.active.id, idx: n.idx },
    exercises: pr.exercises.map(e => ({ name: e.name, muscle: e.muscle, sets: e.rows.map(() => ({ kg: '', reps: '', done: false })) }))
  };
}

// Suggestion card for an exercise of a program workout (null for exercises the user added).
let recCache = { key: '', pr: null };
export function programRec(data, workout, exName, now = new Date()) {
  const ps = workout && workout.programSession;
  const st = programsOf(data);
  if (!ps || !st.active || st.active.id !== ps.id) return null;
  // One prescription per render, not one per exercise.
  const key = `${ps.id}:${ps.idx}:${data.workouts.length}:${isoDate(now)}`;
  if (recCache.key !== key) recCache = { key, pr: sessionPrescription(data, st.active, ps.idx, now) };
  const pr = recCache.pr;
  const e = pr && pr.exercises.find(x => same(x.name, exName));
  if (!e) return null;
  const working = e.rows.filter(r => r.working);
  const all = sessionsOf(st.active);
  const week = ps.idx >= all.length - TEST_WEEK.length ? pr.prog.weeks : Math.floor(ps.idx / pr.prog.days) + 1;
  return {
    type: 'program', program: true, title: e.title, reason: e.desc, link: '#/programi',
    head: `${pr.prog.name} · teden ${week}/${pr.prog.weeks}`, last: pr.sess.name,
    plan: e.rows, kg: working.length ? working[0].kg : null, reps: working.map(r => r.reps)
  };
}

// ---- start, finish, results --------------------------------------------------------

export function startFullProgram(data, key, oneRm, now = new Date()) {
  const st = programsOf(data);
  for (const l of CORE) if (oneRm[l] > 0) setOneRm(data, l, oneRm[l]);
  st.active = { id: 'fp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), key, startISO: isoDate(now), oneRm: { ...oneRm } };
}

export function stopFullProgram(data, now = new Date()) {
  const st = programsOf(data);
  if (!st.active) return;
  st.history.push({ ...st.active, endISO: isoDate(now), stopped: true });
  st.active = null;
}

// Called when a workout is finished: tags it with its program session; the
// last session closes the program and takes the tested 1RMs as the new ones.
export function tagFullWorkout(data, workout, programSession, now = new Date()) {
  const st = programsOf(data);
  if (!programSession || !st.active || st.active.id !== programSession.id) return false;
  workout.program = { id: programSession.id, idx: programSession.idx };
  const all = sessionsOf(st.active);
  if (programSession.idx >= all.length - 1) {
    const entry = { ...st.active, endISO: isoDate(now) };
    st.history.push(entry);
    st.active = null;
    const r = programResult(data, entry);
    for (const l of CORE) if (r.lifts[l] && r.lifts[l].after > 0) setOneRm(data, l, r.lifts[l].after);
  }
  return true;
}

function avg(xs) { const v = xs.filter(x => x != null && !Number.isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

function wellnessBetween(data, fromIso, toIso, pick) {
  return avg(Object.entries(data.wellness).filter(([iso]) => iso >= fromIso && iso <= toIso).map(([, e]) => pick(e)));
}

// Results of a program run: tested 1RM per lift, total, bodyweight, sleep,
// stress, sessions done and photos from its start and end.
export function programResult(data, entry) {
  const prog = fullProgramByKey(entry.key);
  const all = sessionsOf(entry);
  const done = programWorkouts(data, entry.id);
  const lifts = {};
  for (const l of CORE) {
    const before = entry.oneRm[l] || null;
    let after = null;
    for (const d of done) {
      const sess = all[d.idx];
      if (!sess || !sess.test || !sess.ex.some(x => x.lift === l)) continue;
      const kg = Math.max(0, ...setsOf(exOf(d.workout, LIFTS[l].name)).map(s => s.kg));
      if (kg > 0) after = kg;
    }
    lifts[l] = { before, after, diff: before && after ? after - before : null };
  }
  const tested = CORE.filter(l => lifts[l].diff != null);
  const end = entry.endISO || isoDate(new Date());
  const days = Math.max(1, Math.round((fromIso(end) - fromIso(entry.startISO)) / 86400000));
  const totalDiff = tested.length ? tested.reduce((a, l) => a + lifts[l].diff, 0) : null;
  const w0 = wellnessBetween(data, isoDate(addDays(fromIso(entry.startISO), -3)), isoDate(addDays(fromIso(entry.startISO), 6)), e => e.weight);
  const w1 = wellnessBetween(data, isoDate(addDays(fromIso(end), -6)), end, e => e.weight);
  const photos = photoList(data).filter(p => p.dateISO >= isoDate(addDays(fromIso(entry.startISO), -7)) && p.dateISO <= isoDate(addDays(fromIso(end), 7)))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const pose = ['front', 'side', 'back', 'other'].find(k => photos.filter(p => p.pose === k).length >= 2);
  const pp = pose ? photos.filter(p => p.pose === pose) : [];
  return {
    prog, lifts, tested, totalDiff, days, weeks: days / 7,
    perWeek: totalDiff != null ? totalDiff / (days / 7) : null,
    planned: all.length, done: done.length,
    weight: { before: w0, after: w1, diff: w0 != null && w1 != null ? w1 - w0 : null },
    sleep: wellnessBetween(data, entry.startISO, end, sleepMinutes),
    stress: wellnessBetween(data, entry.startISO, end, e => e.stress),
    photoPair: pp.length >= 2 ? [pp[0], pp[pp.length - 1]] : null,
    photosAtStart: photos.some(p => p.dateISO <= isoDate(addDays(fromIso(entry.startISO), 3)))
  };
}

// Pearson correlation, for "what goes with more strength" once there are enough programs.
export function correlation(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => x != null && y != null);
  if (pairs.length < 4) return null;
  const mx = avg(pairs.map(p => p[0])), my = avg(pairs.map(p => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
