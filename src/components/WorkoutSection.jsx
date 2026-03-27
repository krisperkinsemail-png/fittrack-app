import { useEffect, useMemo, useState } from "react";
import { getAllWorkoutSystems } from "../lib/workoutTemplates";

const REST_PRESETS = [60, 90, 120, 180];

function createSet() {
  return {
    id: crypto.randomUUID(),
    reps: "",
    weight: "",
  };
}

function createExerciseDraft(exercise) {
  return {
    id: crypto.randomUUID(),
    name: exercise.name,
    target: exercise.target,
    sets: Array.from({ length: exercise.defaultSets || 1 }, () => createSet()),
  };
}

function createWorkoutDraft(workout) {
  return workout.exercises.map(createExerciseDraft);
}

function summarizeSession(entry) {
  const totalSets = entry.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const totalVolume = entry.exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.reduce(
        (exerciseSum, set) => exerciseSum + Number(set.reps || 0) * Number(set.weight || 0),
        0
      ),
    0
  );

  return { totalSets, totalVolume };
}

function normalizeExerciseName(value) {
  return value.trim().toLowerCase();
}

export function WorkoutSection({
  selectedDate,
  entries,
  recentEntries,
  allEntries,
  customSystems,
  onAddEntry,
  onDeleteEntry,
  onSaveSystem,
  onDeleteSystem,
}) {
  const workoutSystems = useMemo(() => getAllWorkoutSystems(customSystems), [customSystems]);
  const [selectedSystemId, setSelectedSystemId] = useState(workoutSystems[0].id);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(workoutSystems[0].workouts[0].id);
  const [draftExercises, setDraftExercises] = useState(createWorkoutDraft(workoutSystems[0].workouts[0]));
  const [customExerciseName, setCustomExerciseName] = useState("");
  const [templateForm, setTemplateForm] = useState({
    systemName: "",
    workoutName: "",
    summary: "",
  });
  const [restDuration, setRestDuration] = useState(90);
  const [timeLeft, setTimeLeft] = useState(90);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const selectedSystem = useMemo(
    () => workoutSystems.find((system) => system.id === selectedSystemId) || workoutSystems[0],
    [selectedSystemId, workoutSystems]
  );

  const selectedWorkout = useMemo(
    () =>
      selectedSystem.workouts.find((workout) => workout.id === selectedWorkoutId) ||
      selectedSystem.workouts[0],
    [selectedSystem, selectedWorkoutId]
  );

  useEffect(() => {
    if (!workoutSystems.some((system) => system.id === selectedSystemId)) {
      setSelectedSystemId(workoutSystems[0].id);
    }
  }, [selectedSystemId, workoutSystems]);

  useEffect(() => {
    setSelectedWorkoutId(selectedSystem.workouts[0].id);
  }, [selectedSystemId, selectedSystem]);

  useEffect(() => {
    setDraftExercises(createWorkoutDraft(selectedWorkout));
  }, [selectedWorkout]);

  useEffect(() => {
    setTemplateForm({
      systemName: selectedSystem.name,
      workoutName: selectedWorkout.name,
      summary: selectedWorkout.summary,
    });
  }, [selectedSystem, selectedWorkout]);

  useEffect(() => {
    let intervalId;

    if (isTimerRunning && timeLeft > 0) {
      intervalId = window.setInterval(() => {
        setTimeLeft((current) => current - 1);
      }, 1000);
    } else if (timeLeft <= 0) {
      setIsTimerRunning(false);
    }

    return () => window.clearInterval(intervalId);
  }, [isTimerRunning, timeLeft]);

  const draftSummary = useMemo(() => {
    const plannedSets = draftExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    return {
      exerciseCount: draftExercises.length,
      plannedSets,
    };
  }, [draftExercises]);

  const latestMatchingWorkout = useMemo(
    () =>
      [...allEntries]
        .sort((left, right) => new Date(right.date) - new Date(left.date))
        .find((entry) => entry.workoutId === selectedWorkout.id),
    [allEntries, selectedWorkout.id]
  );

  const previousExerciseMap = useMemo(() => {
    if (!latestMatchingWorkout) {
      return new Map();
    }

    return new Map(
      latestMatchingWorkout.exercises.map((exercise) => [
        normalizeExerciseName(exercise.name),
        exercise,
      ])
    );
  }, [latestMatchingWorkout]);

  function addCustomExercise() {
    const trimmedName = customExerciseName.trim();

    if (!trimmedName) {
      return;
    }

    setDraftExercises((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: trimmedName,
        target: "Custom",
        sets: [createSet()],
      },
    ]);
    setCustomExerciseName("");
  }

  function updateExerciseName(exerciseId, value) {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, name: value } : exercise
      )
    );
  }

  function updateExerciseTarget(exerciseId, value) {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, target: value } : exercise
      )
    );
  }

  function addSet(exerciseId) {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: [...exercise.sets, createSet()] }
          : exercise
      )
    );
  }

  function removeSet(exerciseId, setId) {
    setDraftExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const nextSets = exercise.sets.filter((set) => set.id !== setId);
        return { ...exercise, sets: nextSets.length ? nextSets : [createSet()] };
      })
    );
  }

  function updateSet(exerciseId, setId, field, value) {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, [field]: value } : set
              ),
            }
          : exercise
      )
    );
  }

  function removeExercise(exerciseId) {
    setDraftExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
  }

  function applyPreviousSets(exerciseId, previousExercise) {
    setDraftExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: previousExercise.sets.map((set) => ({
                id: crypto.randomUUID(),
                reps: String(set.reps ?? ""),
                weight: String(set.weight ?? ""),
              })),
            }
          : exercise
      )
    );
  }

  function handleSaveWorkout() {
    const exercises = draftExercises
      .map((exercise) => ({
        name: exercise.name.trim(),
        target: exercise.target,
        sets: exercise.sets
          .map((set) => ({
            reps: Number(set.reps),
            weight: Number(set.weight),
          }))
          .filter((set) => Number.isFinite(set.reps) && Number.isFinite(set.weight)),
      }))
      .filter((exercise) => exercise.name && exercise.sets.length);

    if (!exercises.length) {
      return;
    }

    onAddEntry({
      date: selectedDate,
      systemId: selectedSystem.id,
      systemName: selectedSystem.name,
      workoutId: selectedWorkout.id,
      workoutName: selectedWorkout.name,
      exercises,
    });

    setDraftExercises(createWorkoutDraft(selectedWorkout));
  }

  function saveTemplate(overwrite = false) {
    const systemName = templateForm.systemName.trim();
    const workoutName = templateForm.workoutName.trim();
    const summary = templateForm.summary.trim();

    if (!systemName || !workoutName || !draftExercises.length) {
      return;
    }

    const templateExercises = draftExercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({
        name: exercise.name.trim(),
        target: exercise.target.trim() || "Custom",
        defaultSets: exercise.sets.length || 1,
      }));

    const existingCustomSystem = customSystems.find(
      (system) => system.name.toLowerCase() === systemName.toLowerCase()
    );

    const systemId = overwrite && selectedSystem.isCustom
      ? selectedSystem.id
      : existingCustomSystem?.id;

    const existingWorkouts = systemId
      ? (customSystems.find((system) => system.id === systemId)?.workouts || [])
      : [];

    const nextWorkout = {
      id: overwrite && selectedSystem.isCustom ? selectedWorkout.id : undefined,
      name: workoutName,
      summary: summary || "Custom workout",
      exercises: templateExercises,
    };

    const mergedWorkouts = overwrite && selectedSystem.isCustom
      ? existingWorkouts.map((workout) =>
          workout.id === selectedWorkout.id ? { ...workout, ...nextWorkout } : workout
        )
      : [...existingWorkouts, nextWorkout];

    onSaveSystem({
      id: systemId,
      name: systemName,
      description: "Custom workout system",
      isCustom: true,
      workouts: mergedWorkouts,
    });
  }

  function formatTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workout tracking</p>
            <h2>Build the session, then log each set cleanly</h2>
          </div>
          <p className="muted">Selected day: {selectedDate}</p>
        </div>

        <div className="workout-system-grid">
          {workoutSystems.map((system) => (
            <button
              key={system.id}
              type="button"
              className={
                system.id === selectedSystemId
                  ? "workout-chip workout-chip--selected"
                  : "workout-chip"
              }
              onClick={() => setSelectedSystemId(system.id)}
            >
              <strong>{system.name}</strong>
              <span>{system.description}</span>
            </button>
          ))}
        </div>

        <div className="workout-picker-header">
          <div>
            <p className="eyebrow">Select workout</p>
            <h3>{selectedSystem.name}</h3>
          </div>
          <p className="muted">
            Switching workouts reloads the active template automatically.
          </p>
        </div>

        <div className="workout-system-grid">
          {selectedSystem.workouts.map((workout) => (
            <button
              key={workout.id}
              type="button"
              className={
                workout.id === selectedWorkoutId
                  ? "workout-chip workout-chip--selected"
                  : "workout-chip"
              }
              onClick={() => setSelectedWorkoutId(workout.id)}
            >
              <strong>{workout.name}</strong>
              <span>{workout.summary}</span>
            </button>
          ))}
        </div>

        <div className="summary-grid">
          <div className="summary-panel">
            <span>Current template</span>
            <strong>{selectedWorkout.name}</strong>
          </div>
          <div className="summary-panel">
            <span>Planned work</span>
            <strong>
              {draftSummary.exerciseCount} exercises • {draftSummary.plannedSets} sets
            </strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rest timer</p>
            <h2>Keep the pace tight between sets</h2>
          </div>
          <p className="muted">Pick a preset, then start or reset the countdown.</p>
        </div>

        <div className="timer-panel">
          <strong className="timer-readout">{formatTimer(timeLeft)}</strong>
          <div className="button-row">
            {REST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={
                  preset === restDuration
                    ? "secondary-button is-selected-accent"
                    : "secondary-button"
                }
                onClick={() => {
                  setRestDuration(preset);
                  setTimeLeft(preset);
                  setIsTimerRunning(false);
                }}
              >
                {preset / 60}m
              </button>
            ))}
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => setIsTimerRunning((current) => !current)}
            >
              {isTimerRunning ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setTimeLeft(restDuration);
                setIsTimerRunning(false);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Active workout</p>
            <h2>{selectedWorkout.name}</h2>
          </div>
          <p className="muted">
            Log actual reps and load per set. Only filled sets are saved.
          </p>
        </div>

        {latestMatchingWorkout ? (
          <div className="summary-panel">
            <span>Last saved {selectedWorkout.name}</span>
            <strong>{latestMatchingWorkout.date}</strong>
          </div>
        ) : null}

        <div className="inline-form">
          <label>
            Add custom exercise
            <input
              value={customExerciseName}
              onChange={(event) => setCustomExerciseName(event.target.value)}
              placeholder="Cable fly"
            />
          </label>
          <button type="button" className="secondary-button" onClick={addCustomExercise}>
            Add exercise
          </button>
        </div>

        <div className="list-stack">
          {draftExercises.map((exercise, exerciseIndex) => {
            const previousExercise = previousExerciseMap.get(
              normalizeExerciseName(exercise.name)
            );

            return (
            <article className="exercise-card" key={exercise.id}>
              {previousExercise ? (
                <div className="previous-lift-panel">
                  <div>
                    <span className="set-label">Last workout</span>
                    <strong>
                      {previousExercise.sets
                        .map((set) => `${set.reps} x ${set.weight}`)
                        .join(" • ")}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => applyPreviousSets(exercise.id, previousExercise)}
                  >
                    Use last sets
                  </button>
                </div>
              ) : null}

              <div className="log-card__top">
                <div className="exercise-title-group">
                  <span className="exercise-index">{exerciseIndex + 1}</span>
                  <div className="exercise-title-text">
                    <input
                      value={exercise.name}
                      onChange={(event) => updateExerciseName(exercise.id, event.target.value)}
                      aria-label={`Exercise ${exerciseIndex + 1} name`}
                    />
                    <input
                      value={exercise.target}
                      onChange={(event) => updateExerciseTarget(exercise.id, event.target.value)}
                      aria-label={`Exercise ${exerciseIndex + 1} target`}
                      placeholder="4 x 8-10"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={() => removeExercise(exercise.id)}
                >
                  Remove
                </button>
              </div>

              <div className="set-grid">
                {exercise.sets.map((set, setIndex) => (
                  <div className="set-row" key={set.id}>
                    <span className="set-label">Set {setIndex + 1}</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="Reps"
                      value={set.reps}
                      onChange={(event) =>
                        updateSet(exercise.id, set.id, "reps", event.target.value)
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      placeholder="Weight"
                      value={set.weight}
                      onChange={(event) =>
                        updateSet(exercise.id, set.id, "weight", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => removeSet(exercise.id, set.id)}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => addSet(exercise.id)}
              >
                Add set
              </button>
            </article>
          )})}
        </div>

        <button type="button" className="primary-button" onClick={handleSaveWorkout}>
          Save completed workout
        </button>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Program editor</p>
            <h2>Save custom systems and workout templates</h2>
          </div>
          <p className="muted">Use the current active workout as the template source.</p>
        </div>

        <div className="form-grid">
          <label>
            System name
            <input
              value={templateForm.systemName}
              onChange={(event) =>
                setTemplateForm((current) => ({ ...current, systemName: event.target.value }))
              }
              placeholder="Upper / Lower Block"
            />
          </label>
          <label>
            Workout name
            <input
              value={templateForm.workoutName}
              onChange={(event) =>
                setTemplateForm((current) => ({ ...current, workoutName: event.target.value }))
              }
              placeholder="Upper A"
            />
          </label>
          <label>
            Summary
            <input
              value={templateForm.summary}
              onChange={(event) =>
                setTemplateForm((current) => ({ ...current, summary: event.target.value }))
              }
              placeholder="Chest, back, delts"
            />
          </label>
        </div>

        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => saveTemplate(false)}>
            Save as custom template
          </button>
          {selectedSystem.isCustom ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => saveTemplate(true)}
              >
                Update selected template
              </button>
              <button
                type="button"
                className="secondary-button danger-button"
                onClick={() => onDeleteSystem(selectedSystem.id)}
              >
                Delete custom system
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workout history</p>
            <h2>{entries.length} saved for selected day</h2>
          </div>
          <p className="muted">Sessions are grouped by workout, not individual lifts.</p>
        </div>

        {entries.length ? (
          <div className="list-stack">
            {entries.map((entry) => {
              const summary = summarizeSession(entry);

              return (
                <article className="log-card" key={entry.id}>
                  <div className="log-card__top">
                    <div>
                      <h3>{entry.workoutName}</h3>
                      <p className="muted">
                        {entry.systemName} • {entry.date}
                      </p>
                    </div>
                    <strong>{summary.totalSets} sets</strong>
                  </div>
                  <p className="muted">{Math.round(summary.totalVolume)} total volume</p>
                  <div className="exercise-history-list">
                    {entry.exercises.map((exercise) => (
                      <div className="exercise-history-row" key={`${entry.id}-${exercise.name}`}>
                        <span>{exercise.name}</span>
                        <span>
                          {exercise.sets
                            .map((set) => `${set.reps} x ${set.weight}`)
                            .join(" • ")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary-button danger-button"
                      onClick={() => onDeleteEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-panel">
            <p>No workouts logged for this day.</p>
          </div>
        )}

        {recentEntries.length ? (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recent</p>
                <h2>Latest sessions</h2>
              </div>
            </div>
            <div className="list-stack">
              {recentEntries.map((entry) => {
                const summary = summarizeSession(entry);

                return (
                  <article className="log-card" key={entry.id}>
                    <div className="log-card__top">
                      <div>
                        <h3>{entry.workoutName}</h3>
                        <p className="muted">{entry.date}</p>
                      </div>
                      <strong>{summary.totalSets} sets</strong>
                    </div>
                    <p className="muted">{entry.systemName}</p>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
