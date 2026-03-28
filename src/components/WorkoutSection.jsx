import { useEffect, useMemo, useState } from "react";
import { getAllWorkoutSystems } from "../lib/workoutTemplates";
import { formatLongDate } from "../lib/date";

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
    notes: exercise.notes || "",
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

function startOfDay(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function getDayDifference(leftDate, rightDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfDay(leftDate) - startOfDay(rightDate)) / msPerDay);
}

function getEntrySetCount(entry) {
  return entry.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
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
  const workoutPrograms = useMemo(() => getAllWorkoutSystems(customSystems), [customSystems]);
  const [selectedProgramId, setSelectedProgramId] = useState(workoutPrograms[0].id);
  const [selectedPhaseId, setSelectedPhaseId] = useState(
    workoutPrograms[0].phases?.[0]?.id || null
  );
  const initialWorkouts = workoutPrograms[0].phases?.[0]?.workouts || workoutPrograms[0].workouts;
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(initialWorkouts[0].id);
  const [draftExercises, setDraftExercises] = useState(createWorkoutDraft(initialWorkouts[0]));
  const [customExerciseName, setCustomExerciseName] = useState("");
  const [templateForm, setTemplateForm] = useState({
    systemName: "",
    workoutName: "",
    summary: "",
  });
  const [restDuration, setRestDuration] = useState(90);
  const [timeLeft, setTimeLeft] = useState(90);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  const selectedProgram = useMemo(
    () => workoutPrograms.find((program) => program.id === selectedProgramId) || workoutPrograms[0],
    [selectedProgramId, workoutPrograms]
  );

  const selectedPhase = useMemo(() => {
    if (!selectedProgram.phases?.length) {
      return null;
    }

    return (
      selectedProgram.phases.find((phase) => phase.id === selectedPhaseId) || selectedProgram.phases[0]
    );
  }, [selectedPhaseId, selectedProgram]);

  const availableWorkouts = selectedPhase?.workouts || selectedProgram.workouts;

  const selectedWorkout = useMemo(
    () => availableWorkouts.find((workout) => workout.id === selectedWorkoutId) || availableWorkouts[0],
    [availableWorkouts, selectedWorkoutId]
  );

  useEffect(() => {
    if (!workoutPrograms.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(workoutPrograms[0].id);
    }
  }, [selectedProgramId, workoutPrograms]);

  useEffect(() => {
    if (selectedProgram.phases?.length) {
      setSelectedPhaseId(selectedProgram.phases[0].id);
      setSelectedWorkoutId(selectedProgram.phases[0].workouts[0].id);
      return;
    }

    setSelectedPhaseId(null);
    setSelectedWorkoutId(selectedProgram.workouts[0].id);
  }, [selectedProgramId, selectedProgram]);

  useEffect(() => {
    if (!selectedPhase) {
      return;
    }

    setSelectedWorkoutId(selectedPhase.workouts[0].id);
  }, [selectedPhaseId, selectedPhase]);

  useEffect(() => {
    setDraftExercises(createWorkoutDraft(selectedWorkout));
  }, [selectedWorkout]);

  useEffect(() => {
    setTemplateForm({
      systemName: selectedProgram.name,
      workoutName: selectedWorkout.name,
      summary: selectedWorkout.summary,
    });
  }, [selectedProgram, selectedWorkout]);

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

  const workoutInsights = useMemo(() => {
    const sortedEntries = [...allEntries].sort((left, right) => new Date(right.date) - new Date(left.date));
    const last30Entries = sortedEntries.filter((entry) => getDayDifference(selectedDate, entry.date) >= 0 && getDayDifference(selectedDate, entry.date) < 30);
    const prior30Entries = sortedEntries.filter((entry) => getDayDifference(selectedDate, entry.date) >= 30 && getDayDifference(selectedDate, entry.date) < 60);
    const last30Sets = last30Entries.reduce((sum, entry) => sum + getEntrySetCount(entry), 0);
    const uniqueExercises = new Set(
      last30Entries.flatMap((entry) => entry.exercises.map((exercise) => normalizeExerciseName(exercise.name)))
    ).size;

    const exerciseBestMap = new Map();

    [...sortedEntries].reverse().forEach((entry) => {
      entry.exercises.forEach((exercise) => {
        const exerciseName = exercise.name.trim();
        if (!exerciseName) {
          return;
        }

        const bestSetWeight = Math.max(
          0,
          ...exercise.sets.map((set) => Number(set.weight || 0))
        );
        const current = exerciseBestMap.get(exerciseName) || {
          exerciseName,
          firstWeight: null,
          latestWeight: null,
          firstDate: null,
          latestDate: null,
        };

        if (current.firstWeight === null) {
          current.firstWeight = bestSetWeight;
          current.firstDate = entry.date;
        }

        current.latestWeight = bestSetWeight;
        current.latestDate = entry.date;
        exerciseBestMap.set(exerciseName, current);
      });
    });

    const improvedExercise = [...exerciseBestMap.values()]
      .filter((exercise) => exercise.firstWeight !== null && exercise.latestWeight !== null)
      .map((exercise) => ({
        ...exercise,
        improvement: exercise.latestWeight - exercise.firstWeight,
      }))
      .sort((left, right) => right.improvement - left.improvement)[0] || null;

    const focusExercise = [...exerciseBestMap.values()]
      .filter(
        (exercise) =>
          exercise.firstWeight !== null &&
          exercise.latestWeight !== null &&
          exercise.firstDate !== exercise.latestDate
      )
      .map((exercise) => ({
        ...exercise,
        improvement: exercise.latestWeight - exercise.firstWeight,
      }))
      .sort((left, right) => left.improvement - right.improvement)[0] || null;

    const strongestRecentExercise = last30Entries
      .flatMap((entry) =>
        entry.exercises.map((exercise) => ({
          name: exercise.name,
          weight: Math.max(0, ...exercise.sets.map((set) => Number(set.weight || 0))),
          date: entry.date,
        }))
      )
      .sort((left, right) => right.weight - left.weight)[0] || null;

    return {
      totalSessions: sortedEntries.length,
      last30Sessions: last30Entries.length,
      prior30Sessions: prior30Entries.length,
      last30Sets,
      uniqueExercises,
      improvedExercise,
      focusExercise,
      strongestRecentExercise,
    };
  }, [allEntries, selectedDate]);

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
      systemId: selectedProgram.id,
      systemName: selectedPhase ? `${selectedProgram.name} • ${selectedPhase.name}` : selectedProgram.name,
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

    const systemId = overwrite && selectedProgram.isCustom
      ? selectedProgram.id
      : existingCustomSystem?.id;

    const existingWorkouts = systemId
      ? (customSystems.find((system) => system.id === systemId)?.workouts || [])
      : [];

    const nextWorkout = {
      id: overwrite && selectedProgram.isCustom ? selectedWorkout.id : undefined,
      name: workoutName,
      summary: summary || "Custom workout",
      exercises: templateExercises,
    };

    const mergedWorkouts = overwrite && selectedProgram.isCustom
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
            <p className="muted">Selected day: {formatLongDate(selectedDate)}</p>
          </div>
          <div className="workout-heading-actions">
            <button
              type="button"
              className="secondary-button workout-insights-button"
              onClick={() => setIsInsightsOpen(true)}
            >
              Growth metrics
            </button>
          </div>
        </div>

        <label>
          Program
          <select value={selectedProgramId} onChange={(event) => setSelectedProgramId(event.target.value)}>
            {workoutPrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>

        {selectedProgram.phases?.length ? (
          <label>
            Mesocycle block
            <select value={selectedPhaseId || ""} onChange={(event) => setSelectedPhaseId(event.target.value)}>
              {selectedProgram.phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name} • {phase.summary}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="workout-picker-header">
          <div>
            <p className="eyebrow">Select workout</p>
            <h3>{selectedPhase ? `${selectedProgram.name} • ${selectedPhase.name}` : selectedProgram.name}</h3>
          </div>
          <p className="muted">
            Switching workouts reloads the active template automatically.
          </p>
        </div>

        <div className="workout-system-grid">
          {availableWorkouts.map((workout) => (
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
              <span>{workout.phaseSummary || workout.summary}</span>
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
            {selectedWorkout.summary || "Log actual reps and load per set. Only filled sets are saved."}
          </p>
        </div>

        {latestMatchingWorkout ? (
          <div className="summary-panel">
            <span>Last saved {selectedWorkout.name}</span>
            <strong>{formatLongDate(latestMatchingWorkout.date)}</strong>
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
                    {exercise.notes ? <p className="muted">{exercise.notes}</p> : null}
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

              {previousExercise ? (
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => applyPreviousSets(exercise.id, previousExercise)}
                  >
                    Use last sets
                  </button>
                </div>
              ) : null}

              <div className="set-grid">
                {exercise.sets.map((set, setIndex) => (
                  <div className="set-row" key={set.id}>
                    <span className="set-label">Set {setIndex + 1}</span>
                    <div className="set-field">
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
                      <span className="set-subtext">
                        Last: {previousExercise?.sets?.[setIndex]?.reps ?? "--"}
                      </span>
                    </div>
                    <div className="set-field">
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
                      <span className="set-subtext">
                        Last: {previousExercise?.sets?.[setIndex]?.weight ?? "--"}
                      </span>
                    </div>
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
          {selectedProgram.isCustom ? (
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
                onClick={() => onDeleteSystem(selectedProgram.id)}
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
                        {entry.systemName} • {formatLongDate(entry.date)}
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
                        <p className="muted">{formatLongDate(entry.date)}</p>
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

      {isInsightsOpen ? (
        <div
          className="insights-modal-backdrop"
          role="presentation"
          onClick={() => setIsInsightsOpen(false)}
        >
          <section
            className="insights-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-insights-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Workout insights</p>
                <h2 id="workout-insights-title">Growth metrics</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsInsightsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="compact-grid compact-grid--two">
              <div className="summary-panel">
                <span>Sessions in last 30 days</span>
                <strong>{workoutInsights.last30Sessions}</strong>
                <p className="muted">{workoutInsights.prior30Sessions} in the prior 30</p>
              </div>
              <div className="summary-panel">
                <span>Total sets in last 30 days</span>
                <strong>{workoutInsights.last30Sets}</strong>
                <p className="muted">{workoutInsights.uniqueExercises} unique exercises</p>
              </div>
              <div className="summary-panel">
                <span>Focus area</span>
                <strong>{workoutInsights.focusExercise?.exerciseName || "Not enough history yet"}</strong>
                <p className="muted">
                  {workoutInsights.focusExercise
                    ? `${Math.round(workoutInsights.focusExercise.improvement)} lb from ${formatLongDate(workoutInsights.focusExercise.firstDate)} to ${formatLongDate(workoutInsights.focusExercise.latestDate)}`
                    : "This fills in once the same lift has been logged on multiple days."}
                </p>
              </div>
              <div className="summary-panel">
                <span>Total logged sessions</span>
                <strong>{workoutInsights.totalSessions}</strong>
                <p className="muted">Across your full workout history</p>
              </div>
            </div>

            <div className="compact-grid compact-grid--two">
              <div className="summary-panel">
                <span>Best improvement</span>
                <strong>
                  {workoutInsights.improvedExercise?.exerciseName || "Not enough history yet"}
                </strong>
                <p className="muted">
                  {workoutInsights.improvedExercise
                    ? `${Math.round(workoutInsights.improvedExercise.improvement)} lb from ${formatLongDate(workoutInsights.improvedExercise.firstDate)} to ${formatLongDate(workoutInsights.improvedExercise.latestDate)}`
                    : "Log the same lift on multiple dates to see progression."}
                </p>
              </div>
              <div className="summary-panel">
                <span>Strongest recent top set</span>
                <strong>
                  {workoutInsights.strongestRecentExercise?.name || "No recent set data"}
                </strong>
                <p className="muted">
                  {workoutInsights.strongestRecentExercise
                    ? `${Math.round(workoutInsights.strongestRecentExercise.weight)} lb on ${formatLongDate(workoutInsights.strongestRecentExercise.date)}`
                    : "This fills in once you log weighted sets."}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
