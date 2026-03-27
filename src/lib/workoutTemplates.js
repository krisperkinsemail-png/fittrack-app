export const WORKOUT_SYSTEMS = [
  {
    id: "ppl",
    name: "Push Pull Legs",
    description: "Classic split with focused push, pull, and leg sessions.",
    workouts: [
      {
        id: "push-a",
        name: "Push A",
        summary: "Chest, shoulders, triceps",
        exercises: [
          { name: "Bench Press", target: "4 x 6-8", defaultSets: 4 },
          { name: "Incline Dumbbell Press", target: "3 x 8-10", defaultSets: 3 },
          { name: "Seated Shoulder Press", target: "3 x 8-10", defaultSets: 3 },
          { name: "Lateral Raise", target: "3 x 12-15", defaultSets: 3 },
          { name: "Cable Pushdown", target: "3 x 10-12", defaultSets: 3 },
        ],
      },
      {
        id: "pull-a",
        name: "Pull A",
        summary: "Back, rear delts, biceps",
        exercises: [
          { name: "Barbell Row", target: "4 x 6-8", defaultSets: 4 },
          { name: "Lat Pulldown", target: "3 x 8-10", defaultSets: 3 },
          { name: "Chest Supported Row", target: "3 x 10-12", defaultSets: 3 },
          { name: "Face Pull", target: "3 x 12-15", defaultSets: 3 },
          { name: "EZ Bar Curl", target: "3 x 10-12", defaultSets: 3 },
        ],
      },
      {
        id: "legs-a",
        name: "Legs A",
        summary: "Quads, posterior chain, calves",
        exercises: [
          { name: "Back Squat", target: "4 x 5-6", defaultSets: 4 },
          { name: "Romanian Deadlift", target: "3 x 8-10", defaultSets: 3 },
          { name: "Walking Lunge", target: "3 x 10", defaultSets: 3 },
          { name: "Leg Curl", target: "3 x 12-15", defaultSets: 3 },
          { name: "Standing Calf Raise", target: "4 x 12-15", defaultSets: 4 },
        ],
      },
      {
        id: "upper-accessory",
        name: "Upper Accessory",
        summary: "Pump work and weak-point volume",
        exercises: [
          { name: "Machine Chest Press", target: "3 x 10-12", defaultSets: 3 },
          { name: "Cable Row", target: "3 x 10-12", defaultSets: 3 },
          { name: "Dumbbell Shoulder Press", target: "3 x 10", defaultSets: 3 },
          { name: "Cable Fly", target: "2 x 15", defaultSets: 2 },
          { name: "Hammer Curl", target: "3 x 12", defaultSets: 3 },
        ],
      },
    ],
  },
  {
    id: "mezzo-5",
    name: "Mezzo 5 Week Cycle",
    description: "Week-based progression with accumulation, intensity, and peak sessions.",
    workouts: [
      {
        id: "week-1-base",
        name: "Week 1 Base",
        summary: "Build baseline volume",
        exercises: [
          { name: "High Bar Squat", target: "4 x 8", defaultSets: 4 },
          { name: "Bench Press", target: "4 x 8", defaultSets: 4 },
          { name: "Lat Pulldown", target: "3 x 12", defaultSets: 3 },
          { name: "Romanian Deadlift", target: "3 x 10", defaultSets: 3 },
        ],
      },
      {
        id: "week-2-build",
        name: "Week 2 Build",
        summary: "Slightly heavier with moderate volume",
        exercises: [
          { name: "Front Squat", target: "4 x 6", defaultSets: 4 },
          { name: "Incline Bench Press", target: "4 x 6", defaultSets: 4 },
          { name: "Pendlay Row", target: "4 x 8", defaultSets: 4 },
          { name: "Split Squat", target: "3 x 10", defaultSets: 3 },
        ],
      },
      {
        id: "week-3-overreach",
        name: "Week 3 Overreach",
        summary: "Highest workload before pulling back",
        exercises: [
          { name: "Deadlift", target: "5 x 5", defaultSets: 5 },
          { name: "Bench Press", target: "5 x 5", defaultSets: 5 },
          { name: "Pull-Up", target: "4 x 8", defaultSets: 4 },
          { name: "Leg Press", target: "4 x 12", defaultSets: 4 },
        ],
      },
      {
        id: "week-4-deload",
        name: "Week 4 Deload",
        summary: "Lower fatigue, keep movement quality",
        exercises: [
          { name: "Goblet Squat", target: "3 x 8", defaultSets: 3 },
          { name: "Dumbbell Bench Press", target: "3 x 8", defaultSets: 3 },
          { name: "Cable Row", target: "3 x 10", defaultSets: 3 },
          { name: "Back Extension", target: "2 x 12", defaultSets: 2 },
        ],
      },
      {
        id: "week-5-peak",
        name: "Week 5 Peak",
        summary: "Top-end work with lower volume",
        exercises: [
          { name: "Back Squat", target: "4 x 3", defaultSets: 4 },
          { name: "Bench Press", target: "4 x 3", defaultSets: 4 },
          { name: "Weighted Pull-Up", target: "4 x 5", defaultSets: 4 },
          { name: "Romanian Deadlift", target: "3 x 5", defaultSets: 3 },
        ],
      },
    ],
  },
];

export function getSystemById(systemId) {
  return WORKOUT_SYSTEMS.find((system) => system.id === systemId) || WORKOUT_SYSTEMS[0];
}

export function getAllWorkoutSystems(customSystems = []) {
  return [...customSystems, ...WORKOUT_SYSTEMS];
}
