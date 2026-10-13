import { SL_TO_EN } from './exercises.js';

const STORAGE_KEY = 'gymapp:v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Monday-first day-of-week index (0=Mon .. 6=Sun)
function dowMon(d) {
  return (d.getDay() + 6) % 7;
}

function seedData() {
  const today = new Date();
  const monday = addDays(today, -dowMon(today));

  const templates = [
    { id: uid(), name: 'Push', summary: 'prsa, rame, triceps', exercises: [
      { name: 'Bench Press', muscle: 'Chest' },
      { name: 'Incline Bench Press', muscle: 'Chest' },
      { name: 'Overhead Press', muscle: 'Shoulders' },
      { name: 'Lateral Raise', muscle: 'Shoulders' },
      { name: 'Triceps Pushdown', muscle: 'Triceps' },
      { name: 'Skullcrusher', muscle: 'Triceps' }
    ] },
    { id: uid(), name: 'Pull', summary: 'hrbet, biceps', exercises: [
      { name: 'Deadlift', muscle: 'Back' },
      { name: 'Pull-ups', muscle: 'Back' },
      { name: 'Barbell Row', muscle: 'Back' },
      { name: 'Face Pull', muscle: 'Back' },
      { name: 'Dumbbell Curl', muscle: 'Biceps' },
      { name: 'Concentration Curl', muscle: 'Biceps' }
    ] },
    { id: uid(), name: 'Noge', summary: 'noge, zadnjica', exercises: [
      { name: 'Squat', muscle: 'Quads' },
      { name: 'Romanian Deadlift', muscle: 'Hamstrings & Glutes' },
      { name: 'Leg Press', muscle: 'Quads' },
      { name: 'Lunges', muscle: 'Quads' },
      { name: 'Standing Calf Raise', muscle: 'Calves' }
    ] }
  ];

  function mkSets(base, count) {
    const sets = [];
    for (let i = 0; i < count; i++) sets.push({ kg: base + i * 2.5, reps: 8 + (i === count - 1 ? -2 : 0) });
    return sets;
  }

  const workouts = [
    { offset: -8, name: 'Noge', min: 61, exercises: [
      { name: 'Squat', muscle: 'Quads', sets: mkSets(100, 5) },
      { name: 'Romanian Deadlift', muscle: 'Hamstrings & Glutes', sets: mkSets(80, 4) },
      { name: 'Leg Press', muscle: 'Quads', sets: mkSets(140, 4) },
      { name: 'Lunges', muscle: 'Quads', sets: mkSets(20, 3) },
      { name: 'Standing Calf Raise', muscle: 'Calves', sets: mkSets(60, 4) }
    ] },
    { offset: -6, name: 'Full body', min: 47, exercises: [
      { name: 'Squat', muscle: 'Quads', sets: mkSets(90, 3) },
      { name: 'Bench Press', muscle: 'Chest', sets: mkSets(60, 4) },
      { name: 'Barbell Row', muscle: 'Back', sets: mkSets(55, 3) },
      { name: 'Overhead Press', muscle: 'Shoulders', sets: mkSets(35, 3) },
      { name: 'Dumbbell Curl', muscle: 'Biceps', sets: mkSets(15, 3) }
    ] },
    { offset: -3, name: 'Push · prsa, rame, triceps', min: 55, exercises: [
      { name: 'Bench Press', muscle: 'Chest', sets: mkSets(62.5, 4) },
      { name: 'Incline Bench Press', muscle: 'Chest', sets: mkSets(50, 3) },
      { name: 'Overhead Press', muscle: 'Shoulders', sets: mkSets(40, 3) },
      { name: 'Lateral Raise', muscle: 'Shoulders', sets: mkSets(12, 3) },
      { name: 'Triceps Pushdown', muscle: 'Triceps', sets: mkSets(25, 3) },
      { name: 'Skullcrusher', muscle: 'Triceps', sets: mkSets(20, 3) }
    ] },
    { offset: -2, name: 'Pull · hrbet, biceps', min: 52, exercises: [
      { name: 'Deadlift', muscle: 'Back', sets: mkSets(120, 3) },
      { name: 'Pull-ups', muscle: 'Back', sets: mkSets(0, 4) },
      { name: 'Barbell Row', muscle: 'Back', sets: mkSets(57.5, 4) },
      { name: 'Face Pull', muscle: 'Back', sets: mkSets(20, 3) },
      { name: 'Dumbbell Curl', muscle: 'Biceps', sets: mkSets(16, 3) },
      { name: 'Concentration Curl', muscle: 'Biceps', sets: mkSets(10, 3) }
    ] },
    { offset: -1, name: 'Noge', min: 58, exercises: [
      { name: 'Squat', muscle: 'Quads', sets: mkSets(120, 5) },
      { name: 'Romanian Deadlift', muscle: 'Hamstrings & Glutes', sets: mkSets(85, 4) },
      { name: 'Leg Press', muscle: 'Quads', sets: mkSets(150, 4) },
      { name: 'Lunges', muscle: 'Quads', sets: mkSets(22, 3) },
      { name: 'Standing Calf Raise', muscle: 'Calves', sets: mkSets(65, 4) }
    ] }
  ].map(w => {
    const date = addDays(today, w.offset);
    const exercises = w.exercises.map(ex => ({
      name: ex.name, muscle: ex.muscle,
      sets: ex.sets.map(s => ({ kg: s.kg, reps: s.reps, done: true }))
    }));
    return { id: uid(), dateISO: isoDate(date), name: w.name, durationMin: w.min, exercises };
  });

  const wellness = {};
  let w = 80.5;
  for (let i = 30; i >= 0; i--) {
    const date = addDays(today, -i);
    w -= (Math.sin(i * 0.7) * 0.15 + 0.07);
    const bedH = 22 + Math.round(Math.sin(i) * 1);
    const sleepQuality = 3 + Math.round(Math.sin(i * 0.9));
    wellness[isoDate(date)] = {
      weight: Math.round(w * 10) / 10,
      bed: `${String(23).padStart(2, '0')}:${String(10 + (i % 3) * 10).padStart(2, '0')}`,
      wake: `06:${String(30 + (i % 4) * 10).padStart(2, '0')}`,
      quality: Math.min(5, Math.max(1, sleepQuality)),
      mood: Math.min(4, Math.max(0, 2 + Math.round(Math.sin(i * 0.5)))),
      energy: Math.min(10, Math.max(1, 6 + Math.round(Math.sin(i * 0.6) * 3))),
      stress: Math.min(10, Math.max(1, 4 + Math.round(Math.cos(i * 0.4) * 2))),
      note: ''
    };
  }

  return {
    settings: defaultSettings(),
    templates,
    workouts,
    wellness,
    activeWorkout: null,
    meta: { englishExerciseNames: true }
  };
}

function defaultSettings() {
  return {
    userName: 'M',
    themePick: null,
    accent: '#1F63E8',
    textSize: 'M',
    weightUnit: 'kg', heightUnit: 'cm', distUnit: 'km', clock: '24 h',
    goalPerWeek: 4,
    heightCm: 182,
    goalWeightKg: 76.0,
    defaultRestSec: 90,
    morningTime: '07:30',
    plateauWeeks: 4,
    firstDayMonday: true,
    toggles: {
      sound: true, vibe: true, prevValues: true,
      trackWeight: true, trackSleep: true, trackMood: true, trackEnergy: true, trackStress: true, trackWaist: false,
      remindMood: true, remindWeigh: false, remindTraining: true,
      remindMorning: true, morningGate: true,
      reportWeekly: true, reportMonthly: true,
      nutrition: false,
      autoBackup: true
    },
    lastBackupAt: null
  };
}

// A true blank slate — used when the user explicitly deletes all data.
// seedData() is only ever for a brand-new install (nothing in localStorage yet).
function emptyData() {
  return {
    settings: defaultSettings(),
    templates: [],
    workouts: [],
    wellness: {},
    activeWorkout: null
  };
}

// Fill in settings added in newer versions so older saved data keeps working.
function migrate(data) {
  const def = defaultSettings();
  data.settings = { ...def, ...data.settings, toggles: { ...def.toggles, ...(data.settings && data.settings.toggles) } };
  data.meta = data.meta || {};
  if (!data.meta.englishExerciseNames) {
    const rename = ex => {
      const hit = SL_TO_EN[String(ex.name || '').trim().toLowerCase()];
      if (hit) { ex.name = hit[0]; ex.muscle = hit[1]; }
    };
    for (const w of data.workouts || []) (w.exercises || []).forEach(rename);
    for (const t of data.templates || []) (t.exercises || []).forEach(rename);
    if (data.activeWorkout) (data.activeWorkout.exercises || []).forEach(rename);
    data.meta.englishExerciseNames = true;
  }
  return data;
}

class Store {
  constructor() {
    this.data = this.load();
    this.listeners = new Set();
  }
  load() {
    let parsed = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (e) { /* corrupt storage, fall through to reseed */ }
    if (parsed) {
      // A failed migration must never fall through to reseeding real data.
      try { return migrate(parsed); } catch (e) { console.warn('Migracija ni uspela:', e); return parsed; }
    }
    const seeded = seedData();
    this.persist(seeded);
    return seeded;
  }
  persist(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  save() {
    this.persist(this.data);
    for (const fn of this.listeners) fn(this.data);
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = emptyData();
    this.save();
  }
}

export const store = new Store();
export { uid, isoDate, addDays, dowMon, migrate };
