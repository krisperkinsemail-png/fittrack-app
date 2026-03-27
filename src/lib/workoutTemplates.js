import yearProgram from "./yearProgram.json";

function buildTarget(exercise) {
  return `${exercise.sets} x ${exercise.reps}`;
}

function buildNotes(exercise, phaseRules = {}) {
  const segments = [];

  if (exercise.tempo) {
    segments.push(`Tempo ${exercise.tempo}`);
  }

  if (exercise.rest_seconds) {
    segments.push(`Rest ${exercise.rest_seconds}s`);
  }

  if (phaseRules.rir_range) {
    segments.push(`RIR ${phaseRules.rir_range}`);
  }

  if (exercise.details) {
    segments.push(exercise.details);
  }

  return segments.join(" • ");
}

function normalizeMesocycleProgram(program) {
  return {
    id: "mesocycle-year",
    name: "Mesocycle",
    description: "Yearlong hypertrophy and fat-loss program organized into mesocycles and weekly day splits.",
    phases: program.mesocycles.map((mesocycle) => ({
      id: `mesocycle-${mesocycle.mesocycle}`,
      name: `Mesocycle ${mesocycle.mesocycle}`,
      summary: mesocycle.name,
      detail: mesocycle.goal,
      workouts: Object.entries(mesocycle.days).map(([dayKey, day]) => ({
        id: `mesocycle-${mesocycle.mesocycle}-${dayKey}`,
        dayKey,
        name: day.name,
        summary: mesocycle.name,
        phaseSummary: `${mesocycle.name} • ${mesocycle.weeks} weeks`,
        exercises: day.exercises.map((exercise) => ({
          name: exercise.exercise,
          target: buildTarget(exercise),
          defaultSets: exercise.sets || mesocycle.global_rules?.sets_default || 1,
          notes: buildNotes(exercise, mesocycle.global_rules),
        })),
      })),
    })),
  };
}

function normalizeProgram(program) {
  if (program.phases?.length) {
    return program;
  }

  return {
    ...program,
    phases: null,
  };
}

export const WORKOUT_PROGRAMS = [
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
          { name: "Bench Press", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Incline Dumbbell Press", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Seated Shoulder Press", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Lateral Raise", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Cable Pushdown", target: "3 x 10-12", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "pull-a",
        name: "Pull A",
        summary: "Back, rear delts, biceps",
        exercises: [
          { name: "Barbell Row", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Lat Pulldown", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Chest Supported Row", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Face Pull", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "EZ Bar Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "legs-a",
        name: "Legs A",
        summary: "Quads, posterior chain, calves",
        exercises: [
          { name: "Back Squat", target: "4 x 5-6", defaultSets: 4, notes: "" },
          { name: "Romanian Deadlift", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Walking Lunge", target: "3 x 10", defaultSets: 3, notes: "" },
          { name: "Leg Curl", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Standing Calf Raise", target: "4 x 12-15", defaultSets: 4, notes: "" },
        ],
      },
      {
        id: "upper-accessory",
        name: "Upper Accessory",
        summary: "Pump work and weak-point volume",
        exercises: [
          { name: "Machine Chest Press", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Cable Row", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Dumbbell Shoulder Press", target: "3 x 10", defaultSets: 3, notes: "" },
          { name: "Cable Fly", target: "2 x 15", defaultSets: 2, notes: "" },
          { name: "Hammer Curl", target: "3 x 12", defaultSets: 3, notes: "" },
        ],
      },
    ],
  },
  normalizeMesocycleProgram(yearProgram),
];

export function getAllWorkoutSystems(customSystems = []) {
  return [...customSystems.map(normalizeProgram), ...WORKOUT_PROGRAMS];
}
