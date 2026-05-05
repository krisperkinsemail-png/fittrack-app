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
          {
            name: "Weighted Dip",
            target: "3 x 6-10",
            defaultSets: 3,
            notes: "Bodyweight until form is clean, then load via belt/vest.",
          },
        ],
      },
      {
        id: "pull-a",
        name: "Pull A",
        summary: "Back, rear delts, biceps",
        exercises: [
          { name: "Barbell Row", target: "4 x 6-8", defaultSets: 4, notes: "" },
          {
            name: "Pull-Up (pronated, shoulder-width)",
            target: "3 x 6-10",
            defaultSets: 3,
            notes: "Weighted when bodyweight 10+ reps is easy.",
          },
          { name: "Chest Supported Row", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Face Pull", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "EZ Bar Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "legs-a",
        name: "Legs A",
        summary: "Quads, posterior chain, calves, core",
        exercises: [
          { name: "Back Squat", target: "4 x 5-6", defaultSets: 4, notes: "" },
          { name: "Romanian Deadlift", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Walking Lunge", target: "3 x 10", defaultSets: 3, notes: "" },
          { name: "Leg Curl", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Standing Calf Raise", target: "4 x 12-15", defaultSets: 4, notes: "" },
          {
            name: "Hanging Leg Raise",
            target: "3 x 10-15",
            defaultSets: 3,
            notes: "Direct core work using the pull-up/dip station.",
          },
        ],
      },
      {
        id: "upper-accessory",
        name: "Upper Accessory",
        summary: "Pump work and weak-point volume",
        exercises: [
          { name: "Machine Chest Press", target: "3 x 10-12", defaultSets: 3, notes: "" },
          {
            name: "Neutral-Grip Pull-Up",
            target: "3 x 8-12",
            defaultSets: 3,
            notes: "Uses neutral handles on the pull-up bar.",
          },
          { name: "Dumbbell Shoulder Press", target: "3 x 10", defaultSets: 3, notes: "" },
          { name: "Cable Fly", target: "2 x 15", defaultSets: 2, notes: "" },
          { name: "Hammer Curl", target: "3 x 12", defaultSets: 3, notes: "" },
          {
            name: "Bodyweight Dip",
            target: "3 x 12-15",
            defaultSets: 3,
            notes: "High-rep complement to weighted dips on Push A.",
          },
          {
            name: "Cable Row",
            target: "3 x 10-12",
            defaultSets: 3,
            notes: "Keeps horizontal pull volume since vertical pull moved to bar.",
          },
        ],
      },
    ],
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    description: "Balanced 4-day split alternating upper-body and lower-body sessions.",
    workouts: [
      {
        id: "upper-a",
        name: "Upper A",
        summary: "Chest, back, shoulders, arms",
        exercises: [
          { name: "Barbell Bench Press", target: "4 x 5-8", defaultSets: 4, notes: "" },
          { name: "Bent Over Row", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Incline Dumbbell Press", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Lat Pulldown", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Lateral Raise", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "EZ Bar Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Cable Pushdown", target: "3 x 10-12", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "lower-a",
        name: "Lower A",
        summary: "Squat focus with quads and hamstrings",
        exercises: [
          { name: "Back Squat", target: "4 x 5-6", defaultSets: 4, notes: "" },
          { name: "Romanian Deadlift", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Leg Press", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Leg Curl", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Walking Lunge", target: "2 x 12", defaultSets: 2, notes: "" },
          { name: "Standing Calf Raise", target: "4 x 12-15", defaultSets: 4, notes: "" },
        ],
      },
      {
        id: "upper-b",
        name: "Upper B",
        summary: "Pressing and pull volume with shoulder work",
        exercises: [
          { name: "Seated Shoulder Press", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Pull-Up", target: "4 x 6-10", defaultSets: 4, notes: "" },
          { name: "Machine Chest Press", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Chest Supported Row", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Cable Fly", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Hammer Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Overhead Rope Extension", target: "3 x 10-12", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "lower-b",
        name: "Lower B",
        summary: "Hinge focus with glutes and calves",
        exercises: [
          { name: "Trap Bar Deadlift", target: "4 x 4-6", defaultSets: 4, notes: "" },
          { name: "Front Squat", target: "3 x 6-8", defaultSets: 3, notes: "" },
          { name: "Bulgarian Split Squat", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Seated Leg Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Hip Thrust", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Seated Calf Raise", target: "4 x 12-15", defaultSets: 4, notes: "" },
        ],
      },
    ],
  },
  {
    id: "full-body",
    name: "Full Body",
    description: "Three full-body sessions built around simple compound lifts and accessories.",
    workouts: [
      {
        id: "full-body-a",
        name: "Full Body A",
        summary: "Squat, press, row",
        exercises: [
          { name: "Back Squat", target: "4 x 5-6", defaultSets: 4, notes: "" },
          { name: "Bench Press", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Barbell Row", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Romanian Deadlift", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Lateral Raise", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Cable Curl", target: "2 x 12", defaultSets: 2, notes: "" },
          { name: "Cable Pushdown", target: "2 x 12", defaultSets: 2, notes: "" },
        ],
      },
      {
        id: "full-body-b",
        name: "Full Body B",
        summary: "Hinge, incline press, vertical pull",
        exercises: [
          { name: "Deadlift", target: "3 x 4-6", defaultSets: 3, notes: "" },
          { name: "Incline Dumbbell Press", target: "4 x 8-10", defaultSets: 4, notes: "" },
          { name: "Lat Pulldown", target: "4 x 8-10", defaultSets: 4, notes: "" },
          { name: "Leg Press", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Seated Shoulder Press", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Hamstring Curl", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Standing Calf Raise", target: "3 x 12-15", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "full-body-c",
        name: "Full Body C",
        summary: "Front squat, machine press, pull-up",
        exercises: [
          { name: "Front Squat", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Machine Chest Press", target: "4 x 8-10", defaultSets: 4, notes: "" },
          { name: "Pull-Up", target: "4 x 6-10", defaultSets: 4, notes: "" },
          { name: "Walking Lunge", target: "3 x 10", defaultSets: 3, notes: "" },
          { name: "Chest Supported Row", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Face Pull", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Hammer Curl", target: "2 x 12", defaultSets: 2, notes: "" },
        ],
      },
    ],
  },
  {
    id: "arnold-split",
    name: "Arnold Split",
    description: "Classic six-day split cycling chest/back, shoulders/arms, and legs twice weekly.",
    workouts: [
      {
        id: "chest-back-a",
        name: "Chest / Back A",
        summary: "Heavy pressing and rowing",
        exercises: [
          { name: "Bench Press", target: "4 x 5-8", defaultSets: 4, notes: "" },
          { name: "Bent Over Row", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Incline Dumbbell Press", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Pull-Up", target: "3 x 6-10", defaultSets: 3, notes: "" },
          { name: "Cable Fly", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Straight Arm Pulldown", target: "3 x 12-15", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "shoulders-arms-a",
        name: "Shoulders / Arms A",
        summary: "Overhead press, delts, biceps, triceps",
        exercises: [
          { name: "Seated Shoulder Press", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Lateral Raise", target: "4 x 12-15", defaultSets: 4, notes: "" },
          { name: "Rear Delt Fly", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "EZ Bar Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Incline Dumbbell Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Cable Pushdown", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Overhead Rope Extension", target: "3 x 10-12", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "legs-a-arnold",
        name: "Legs A",
        summary: "Squat and posterior chain",
        exercises: [
          { name: "Back Squat", target: "4 x 5-6", defaultSets: 4, notes: "" },
          { name: "Romanian Deadlift", target: "4 x 8-10", defaultSets: 4, notes: "" },
          { name: "Leg Press", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Leg Extension", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Seated Leg Curl", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Standing Calf Raise", target: "4 x 12-15", defaultSets: 4, notes: "" },
        ],
      },
      {
        id: "chest-back-b",
        name: "Chest / Back B",
        summary: "Higher-volume machine and cable work",
        exercises: [
          { name: "Machine Chest Press", target: "4 x 8-10", defaultSets: 4, notes: "" },
          { name: "Chest Supported Row", target: "4 x 8-10", defaultSets: 4, notes: "" },
          { name: "Incline Cable Fly", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Lat Pulldown", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Dumbbell Pullover", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Single Arm Cable Row", target: "3 x 12", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "shoulders-arms-b",
        name: "Shoulders / Arms B",
        summary: "Pump-focused delts and arm volume",
        exercises: [
          { name: "Arnold Press", target: "4 x 8-10", defaultSets: 4, notes: "" },
          { name: "Cable Lateral Raise", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Face Pull", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Hammer Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Preacher Curl", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Skull Crusher", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Cable Overhead Extension", target: "3 x 12-15", defaultSets: 3, notes: "" },
        ],
      },
      {
        id: "legs-b-arnold",
        name: "Legs B",
        summary: "Quad and glute volume day",
        exercises: [
          { name: "Front Squat", target: "4 x 6-8", defaultSets: 4, notes: "" },
          { name: "Bulgarian Split Squat", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Hip Thrust", target: "3 x 8-10", defaultSets: 3, notes: "" },
          { name: "Hack Squat", target: "3 x 10-12", defaultSets: 3, notes: "" },
          { name: "Leg Curl", target: "3 x 12-15", defaultSets: 3, notes: "" },
          { name: "Seated Calf Raise", target: "4 x 12-15", defaultSets: 4, notes: "" },
        ],
      },
    ],
  },
  normalizeMesocycleProgram(yearProgram),
];

export function getAllWorkoutSystems(customSystems = []) {
  return [...customSystems.map(normalizeProgram), ...WORKOUT_PROGRAMS];
}
