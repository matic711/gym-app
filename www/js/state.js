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
      { name: 'Potisk s prsi', muscle: 'Prsa · triceps' },
      { name: 'Poševni potisk', muscle: 'Prsa' },
      { name: 'Potisk nad glavo', muscle: 'Rame' },
      { name: 'Odmiki v stran', muscle: 'Rame' },
      { name: 'Triceps na škripcu', muscle: 'Triceps' },
      { name: 'Francoski potisk', muscle: 'Triceps' }
    ] },
    { id: uid(), name: 'Pull', summary: 'hrbet, biceps', exercises: [
      { name: 'Mrtvi dvig', muscle: 'Hrbet · zadnja stegna' },
      { name: 'Zgibi', muscle: 'Hrbet' },
      { name: 'Veslanje', muscle: 'Hrbet' },
      { name: 'Face pull', muscle: 'Zadnje rame' },
      { name: 'Biceps upogibi', muscle: 'Biceps' },
      { name: 'Koncentracijski upogibi', muscle: 'Biceps' }
    ] },
    { id: uid(), name: 'Noge', summary: 'noge, zadnjica', exercises: [
      { name: 'Počep', muscle: 'Kvadriceps · zadnjica' },
      { name: 'Romunski mrtvi dvig', muscle: 'Zadnja stegna' },
      { name: 'Potisk z nogami', muscle: 'Kvadriceps' },
      { name: 'Izpadni koraki', muscle: 'Zadnjica · noge' },
      { name: 'Meča', muscle: 'Meča' }
    ] }
  ];

  function mkSets(base, count) {
    const sets = [];
    for (let i = 0; i < count; i++) sets.push({ kg: base + i * 2.5, reps: 8 + (i === count - 1 ? -2 : 0) });
    return sets;
  }

  const workouts = [
    { offset: -8, name: 'Noge', min: 61, exercises: [
      { name: 'Počep', muscle: 'Kvadriceps · zadnjica', sets: mkSets(100, 5) },
      { name: 'Romunski mrtvi dvig', muscle: 'Zadnja stegna', sets: mkSets(80, 4) },
      { name: 'Potisk z nogami', muscle: 'Kvadriceps', sets: mkSets(140, 4) },
      { name: 'Izpadni koraki', muscle: 'Zadnjica · noge', sets: mkSets(20, 3) },
      { name: 'Meča', muscle: 'Meča', sets: mkSets(60, 4) }
    ] },
    { offset: -6, name: 'Full body', min: 47, exercises: [
      { name: 'Počep', muscle: 'Kvadriceps · zadnjica', sets: mkSets(90, 3) },
      { name: 'Potisk s prsi', muscle: 'Prsa · triceps', sets: mkSets(60, 4) },
      { name: 'Veslanje', muscle: 'Hrbet', sets: mkSets(55, 3) },
      { name: 'Potisk nad glavo', muscle: 'Rame', sets: mkSets(35, 3) },
      { name: 'Biceps upogibi', muscle: 'Biceps', sets: mkSets(15, 3) }
    ] },
    { offset: -3, name: 'Push · prsa, rame, triceps', min: 55, exercises: [
      { name: 'Potisk s prsi', muscle: 'Prsa · triceps', sets: mkSets(62.5, 4) },
      { name: 'Poševni potisk', muscle: 'Prsa', sets: mkSets(50, 3) },
      { name: 'Potisk nad glavo', muscle: 'Rame', sets: mkSets(40, 3) },
      { name: 'Odmiki v stran', muscle: 'Rame', sets: mkSets(12, 3) },
      { name: 'Triceps na škripcu', muscle: 'Triceps', sets: mkSets(25, 3) },
      { name: 'Francoski potisk', muscle: 'Triceps', sets: mkSets(20, 3) }
    ] },
    { offset: -2, name: 'Pull · hrbet, biceps', min: 52, exercises: [
      { name: 'Mrtvi dvig', muscle: 'Hrbet · zadnja stegna', sets: mkSets(120, 3) },
      { name: 'Zgibi', muscle: 'Hrbet', sets: mkSets(0, 4) },
      { name: 'Veslanje', muscle: 'Hrbet', sets: mkSets(57.5, 4) },
      { name: 'Face pull', muscle: 'Zadnje rame', sets: mkSets(20, 3) },
      { name: 'Biceps upogibi', muscle: 'Biceps', sets: mkSets(16, 3) },
      { name: 'Koncentracijski upogibi', muscle: 'Biceps', sets: mkSets(10, 3) }
    ] },
    { offset: -1, name: 'Noge', min: 58, exercises: [
      { name: 'Počep', muscle: 'Kvadriceps · zadnjica', sets: mkSets(120, 5) },
      { name: 'Romunski mrtvi dvig', muscle: 'Zadnja stegna', sets: mkSets(85, 4) },
      { name: 'Potisk z nogami', muscle: 'Kvadriceps', sets: mkSets(150, 4) },
      { name: 'Izpadni koraki', muscle: 'Zadnjica · noge', sets: mkSets(22, 3) },
      { name: 'Meča', muscle: 'Meča', sets: mkSets(65, 4) }
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
    activeWorkout: null
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
    firstDayMonday: true,
    toggles: {
      sound: true, vibe: true, prevValues: true,
      trackWeight: true, trackSleep: true, trackMood: true, trackEnergy: true, trackStress: true, trackWaist: false,
      remindMood: true, remindWeigh: false,
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

class Store {
  constructor() {
    this.data = this.load();
    this.listeners = new Set();
  }
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupt storage, fall through to reseed */ }
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
export { uid, isoDate, addDays, dowMon };
