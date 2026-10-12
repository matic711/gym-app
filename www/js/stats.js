// Per-exercise statistics derived from finished workouts.

function sameName(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// Estimated one-rep max (Epley). Never shown in the UI — analysis.js uses it
// only to compare sessions done with different rep counts.
export function e1rm(kg, reps) {
  kg = Number(kg) || 0;
  reps = Number(reps) || 0;
  if (!kg || !reps) return 0;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

// One entry per workout in which the exercise appears, oldest first.
export function exerciseHistory(data, name) {
  const out = [];
  for (const w of data.workouts) {
    const ex = w.exercises.find(e => sameName(e.name, name));
    if (!ex || !ex.sets.length) continue;
    let topKg = 0, topReps = 0, volume = 0, totalReps = 0;
    for (const s of ex.sets) {
      const kg = Number(s.kg) || 0, reps = Number(s.reps) || 0;
      if (kg > topKg || (kg === topKg && reps > topReps)) { topKg = kg; topReps = reps; }
      volume += kg * reps;
      totalReps += reps;
    }
    out.push({ dateISO: w.dateISO, workoutId: w.id, workoutName: w.name, muscle: ex.muscle || '', sets: ex.sets, topKg, topReps, volume, totalReps });
  }
  return out.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

// Every exercise that appears in a finished workout, most recently done first.
export function allExercises(data) {
  const map = new Map();
  for (const w of data.workouts) {
    for (const ex of w.exercises) {
      if (!ex.sets.length) continue;
      const key = ex.name.trim().toLowerCase();
      const cur = map.get(key) || { name: ex.name, muscle: ex.muscle || '', count: 0, lastISO: '', bestKg: 0, bestReps: 0 };
      cur.count++;
      if (w.dateISO > cur.lastISO) { cur.lastISO = w.dateISO; cur.name = ex.name; cur.muscle = ex.muscle || cur.muscle; }
      for (const s of ex.sets) {
        const kg = Number(s.kg) || 0, reps = Number(s.reps) || 0;
        if (kg > cur.bestKg || (kg === cur.bestKg && reps > cur.bestReps)) { cur.bestKg = kg; cur.bestReps = reps; }
      }
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.lastISO.localeCompare(a.lastISO) || b.count - a.count);
}
