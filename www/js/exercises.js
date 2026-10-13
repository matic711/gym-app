// A broad built-in exercise library, grouped by muscle group, used by the
// "Dodaj vajo" picker in NovTrening. Not an exhaustive registry of every
// exercise that has ever existed — a thorough, practical set covering the
// standard free-weight/machine/bodyweight/cable variants lifters actually use.
export const EXERCISE_LIBRARY = [
  {
    group: 'Chest',
    exercises: [
      'Bench Press', 'Incline Bench Press', 'Decline Bench Press',
      'Dumbbell Bench Press', 'Incline Dumbbell Press',
      'Dumbbell Fly', 'Incline Dumbbell Fly',
      'Cable Crossover', 'Pec Deck (Butterfly)',
      'Push-ups', 'Chest Dips', 'Machine Chest Press', 'Dumbbell Pullover'
    ]
  },
  {
    group: 'Back',
    exercises: [
      'Deadlift', 'Pull-ups', 'Chin-ups',
      'Barbell Row', 'One-arm Dumbbell Row', 'Seated Cable Row',
      'Lat Pulldown', 'Close-grip Lat Pulldown', 'Face Pull',
      'Back Extension', 'T-Bar Row', 'Straight-arm Pulldown'
    ]
  },
  {
    group: 'Shoulders',
    exercises: [
      'Overhead Press', 'Dumbbell Shoulder Press', 'Arnold Press',
      'Lateral Raise', 'Front Raise', 'Rear Delt Fly',
      'Upright Row', 'Machine Shoulder Press', 'Shrugs'
    ]
  },
  {
    group: 'Biceps',
    exercises: [
      'Barbell Curl', 'EZ-Bar Curl',
      'Dumbbell Curl', 'Concentration Curl',
      'Hammer Curl', 'Preacher Curl', 'Cable Curl'
    ]
  },
  {
    group: 'Triceps',
    exercises: [
      'Skullcrusher', 'Triceps Pushdown', 'Overhead Triceps Extension',
      'Close-grip Bench Press', 'Triceps Kickback', 'Dips', 'Diamond Push-ups'
    ]
  },
  {
    group: 'Forearms',
    exercises: ['Wrist Curl', 'Reverse Wrist Curl', 'Grip Trainer', "Farmer's Walk"]
  },
  {
    group: 'Quads',
    exercises: [
      'Squat', 'Front Squat', 'Leg Press', 'Bulgarian Split Squat',
      'Lunges', 'Leg Extension', 'Hack Squat', 'Goblet Squat'
    ]
  },
  {
    group: 'Hamstrings & Glutes',
    exercises: [
      'Romanian Deadlift', 'Single-leg Deadlift', 'Leg Curl',
      'Hip Thrust', 'Glute Bridge', 'Cable Kickback', 'Good Morning'
    ]
  },
  {
    group: 'Calves',
    exercises: ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise']
  },
  {
    group: 'Core',
    exercises: [
      'Crunch', 'Leg Raise', 'Plank', 'Side Plank',
      'Russian Twist', 'Ab Wheel Rollout', 'Hanging Leg Raise', 'Dead Bug', 'Mountain Climbers'
    ]
  },
  {
    group: 'Full Body',
    exercises: ['Snatch', 'Clean and Jerk', 'Kettlebell Swing', 'Burpees', 'Turkish Get-up']
  },
  {
    group: 'Cardio',
    exercises: ['Treadmill Run', 'Cycling', 'Rowing Machine', 'Jump Rope', 'Elliptical', 'Swimming']
  }
];

// Slovenian names used by earlier versions of the app → library name and group.
// Old data is renamed once (state.js migrate) so stats don't split per language.
export const SL_TO_EN = {
  'potisk s prsi': ['Bench Press', 'Chest'],
  'poševni potisk': ['Incline Bench Press', 'Chest'],
  'potisk nad glavo': ['Overhead Press', 'Shoulders'],
  'odmiki v stran': ['Lateral Raise', 'Shoulders'],
  'triceps na škripcu': ['Triceps Pushdown', 'Triceps'],
  'francoski potisk': ['Skullcrusher', 'Triceps'],
  'mrtvi dvig': ['Deadlift', 'Back'],
  'zgibi': ['Pull-ups', 'Back'],
  'veslanje': ['Barbell Row', 'Back'],
  'face pull': ['Face Pull', 'Back'],
  'biceps upogibi': ['Dumbbell Curl', 'Biceps'],
  'koncentracijski upogibi': ['Concentration Curl', 'Biceps'],
  'počep': ['Squat', 'Quads'],
  'romunski mrtvi dvig': ['Romanian Deadlift', 'Hamstrings & Glutes'],
  'potisk z nogami': ['Leg Press', 'Quads'],
  'izpadni koraki': ['Lunges', 'Quads'],
  'meča': ['Standing Calf Raise', 'Calves']
};

// Extra Slovenian search words, so "počep" or "prsa" still finds the English name.
const SL_GROUPS = {
  Chest: 'prsa', Back: 'hrbet', Shoulders: 'rame ramena', Biceps: 'biceps', Triceps: 'triceps',
  Forearms: 'podlakti', Quads: 'noge kvadriceps', 'Hamstrings & Glutes': 'zadnja stegna zadnjica',
  Calves: 'meča', Core: 'trebuh core', 'Full Body': 'celo telo', Cardio: 'kardio'
};
const SL_ALIASES = {};
for (const [sl, [en]] of Object.entries(SL_TO_EN)) SL_ALIASES[en] = (SL_ALIASES[en] ? SL_ALIASES[en] + ' ' : '') + sl;

export function searchExercises(query) {
  const q = query.trim().toLowerCase();
  if (!q) return EXERCISE_LIBRARY;
  return EXERCISE_LIBRARY
    .map(g => {
      const groupText = (g.group + ' ' + (SL_GROUPS[g.group] || '')).toLowerCase();
      return { group: g.group, exercises: g.exercises.filter(e => (e + ' ' + (SL_ALIASES[e] || '')).toLowerCase().includes(q) || groupText.includes(q)) };
    })
    .filter(g => g.exercises.length);
}
