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

export function searchExercises(query) {
  const q = query.trim().toLowerCase();
  if (!q) return EXERCISE_LIBRARY;
  return EXERCISE_LIBRARY
    .map(g => ({ group: g.group, exercises: g.exercises.filter(e => e.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)) }))
    .filter(g => g.exercises.length);
}
