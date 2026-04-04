import { useEffect, useMemo, useRef, useState } from "react";
import { getAllWorkoutSystems } from "../lib/workoutTemplates";
import { formatLongDate } from "../lib/date";

const REST_PRESETS = [60, 90, 120, 180];
const CUSTOM_EXERCISE_BANK_KEY = "fittrack.custom-exercise-bank.v1";
const WORKOUT_DRAFTS_KEY = "fittrack.workout-drafts.v1";

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

function moveItem(items, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
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
  const [templateForm, setTemplateForm] = useState({
    systemName: "",
    workoutName: "",
    summary: "",
  });
  const [restDuration, setRestDuration] = useState(90);
  const [timeLeft, setTimeLeft] = useState(90);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isProgramPickerOpen, setIsProgramPickerOpen] = useState(false);
  const [isWorkoutPickerOpen, setIsWorkoutPickerOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isCustomExerciseModalOpen, setIsCustomExerciseModalOpen] = useState(false);
  const [customExerciseBank, setCustomExerciseBank] = useState(() => loadCustomExerciseBank());
  const [savedWorkoutDraft, setSavedWorkoutDraft] = useState(null);
  const [isDraftActive, setIsDraftActive] = useState(false);
  const [removedExerciseUndo, setRemovedExerciseUndo] = useState(null);
  const [openExerciseId, setOpenExerciseId] = useState(null);
  const exerciseCardRefs = useRef({});
  const timerFloatRef = useRef(null);
  const [openHistoryEntryId, setOpenHistoryEntryId] = useState(null);
  const [customExerciseForm, setCustomExerciseForm] = useState({
    name: "",
    target: "",
    setCount: "3",
    saveToBank: false,
  });
  const [isCustomBuilderOpen, setIsCustomBuilderOpen] = useState(false);
  const [builderStep, setBuilderStep] = useState(1);
  const [builderForm, setBuilderForm] = useState(null);
  const builderExerciseRefs = useRef({});
  const [builderFocusId, setBuilderFocusId] = useState(null);
  const [builderFocusedExId, setBuilderFocusedExId] = useState(null);
  const audioContextRef = useRef(null);
  const previousTimeLeftRef = useRef(timeLeft);

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
    const templateDraft = createWorkoutDraft(selectedWorkout);
    const nextSavedDraft = loadWorkoutDraft(selectedDate, selectedWorkout.id);
    setDraftExercises(templateDraft);
    setSavedWorkoutDraft(nextSavedDraft);
    setIsDraftActive(false);
    setRemovedExerciseUndo(null);
    setOpenExerciseId(null);
  }, [selectedDate, selectedWorkout]);

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

  useEffect(() => {
    if (previousTimeLeftRef.current > 0 && timeLeft === 0) {
      playTimerAlarm(audioContextRef);
    }

    previousTimeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {
          // Ignore cleanup failures from already-closed contexts.
        });
      }
    };
  }, []);

  useEffect(() => {
    if (!builderFocusId) {
      return undefined;
    }

    const ref = builderExerciseRefs.current[builderFocusId];
    if (ref) {
      ref.focus();
      setBuilderFocusId(null);
    }
  }, [builderFocusId]);

  useEffect(() => {
    if (!openExerciseId) {
      return undefined;
    }

    const frameId = requestAnimationFrame(() => {
      const el = exerciseCardRefs.current[openExerciseId];
      if (!el) return;

      const timerEl = timerFloatRef.current;
      if (timerEl) {
        // Timer is pinned at the top — scroll the card top to sit just below it
        const timerBottom = timerEl.getBoundingClientRect().bottom;
        const cardTop = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: cardTop - timerBottom - 12, behavior: "smooth" });
      } else {
        const cardTop = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: cardTop - 80, behavior: "smooth" });
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [openExerciseId]);

  const isDraftDirty = useMemo(
    () => hasDraftChanges(draftExercises, selectedWorkout),
    [draftExercises, selectedWorkout]
  );

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

  useEffect(() => {
    if (!removedExerciseUndo) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRemovedExerciseUndo(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [removedExerciseUndo]);

  useEffect(() => {
    if (!isDraftActive) {
      return;
    }

    if (!isDraftDirty) {
      clearWorkoutDraft(selectedDate, selectedWorkout.id);
      setSavedWorkoutDraft(null);
      setIsDraftActive(false);
      return;
    }

    const nextDraft = {
      date: selectedDate,
      workoutId: selectedWorkout.id,
      workoutName: selectedWorkout.name,
      exercises: cloneWorkoutDraft(draftExercises),
      updatedAt: new Date().toISOString(),
    };
    saveWorkoutDraft(nextDraft);
    setSavedWorkoutDraft(nextDraft);
  }, [draftExercises, isDraftActive, isDraftDirty, selectedDate, selectedWorkout]);

  function updateDraft(updater) {
    setIsDraftActive(true);
    setDraftExercises((current) =>
      typeof updater === "function" ? updater(current) : updater
    );
  }

  function addCustomExerciseDraft({ name, target, setCount }) {
    const trimmedName = name.trim();
    const nextSetCount = Math.max(1, Number(setCount) || 1);

    if (!trimmedName) {
      return;
    }

    const exerciseId = crypto.randomUUID();
    setOpenExerciseId(exerciseId);

    updateDraft((current) => [
      ...current,
      {
        id: exerciseId,
        name: trimmedName,
        target: target.trim() || "Custom",
        sets: Array.from({ length: nextSetCount }, () => createSet()),
      },
    ]);
  }

  function resetCustomExerciseForm() {
    setCustomExerciseForm({
      name: "",
      target: "",
      setCount: "3",
      saveToBank: false,
    });
  }

  function handleApplyCustomExercise() {
    const trimmedName = customExerciseForm.name.trim();
    const nextSetCount = Math.max(1, Number(customExerciseForm.setCount) || 1);

    if (!trimmedName) {
      return;
    }

    addCustomExerciseDraft({
      name: trimmedName,
      target: customExerciseForm.target,
      setCount: nextSetCount,
    });

    if (customExerciseForm.saveToBank) {
      const nextBank = upsertCustomExercise(customExerciseBank, {
        name: trimmedName,
        target: customExerciseForm.target.trim() || "Custom",
        setCount: nextSetCount,
      });
      setCustomExerciseBank(nextBank);
      saveCustomExerciseBank(nextBank);
    }

    resetCustomExerciseForm();
    setIsCustomExerciseModalOpen(false);
  }

  function handleUseSavedCustomExercise(exercise) {
    addCustomExerciseDraft(exercise);
    setIsCustomExerciseModalOpen(false);
  }

  function handleDeleteSavedCustomExercise(exerciseId) {
    const nextBank = customExerciseBank.filter((exercise) => exercise.id !== exerciseId);
    setCustomExerciseBank(nextBank);
    saveCustomExerciseBank(nextBank);
  }

  function updateExerciseName(exerciseId, value) {
    updateDraft((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, name: value } : exercise
      )
    );
  }

  function updateExerciseTarget(exerciseId, value) {
    updateDraft((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, target: value } : exercise
      )
    );
  }

  function addSet(exerciseId) {
    updateDraft((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: [...exercise.sets, createSet()] }
          : exercise
      )
    );
  }

  function removeSet(exerciseId, setId) {
    updateDraft((current) =>
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
    updateDraft((current) =>
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
    updateDraft((current) => {
      const removedIndex = current.findIndex((exercise) => exercise.id === exerciseId);
      if (removedIndex === -1) {
        return current;
      }

      const removedExercise = current[removedIndex];
      setRemovedExerciseUndo({
        exercise: removedExercise,
        index: removedIndex,
      });
      if (openExerciseId === exerciseId) {
        setOpenExerciseId(null);
      }
      return current.filter((exercise) => exercise.id !== exerciseId);
    });
  }

  function moveExercise(exerciseId, direction) {
    updateDraft((current) => {
      const currentIndex = current.findIndex((exercise) => exercise.id === exerciseId);
      if (currentIndex === -1) {
        return current;
      }

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      return moveItem(current, currentIndex, nextIndex);
    });
  }

  function applyPreviousSets(exerciseId, previousExercise) {
    updateDraft((current) =>
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

    clearWorkoutDraft(selectedDate, selectedWorkout.id);
    setSavedWorkoutDraft(null);
    setIsDraftActive(false);
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

  function handleProgramChange(programId) {
    setSelectedProgramId(programId);
    setIsProgramPickerOpen(false);
    setIsWorkoutPickerOpen(false);
  }

  function handlePhaseChange(phaseId) {
    setSelectedPhaseId(phaseId);
    setIsProgramPickerOpen(false);
    setIsWorkoutPickerOpen(false);
  }

  function handleWorkoutChange(workoutId) {
    setSelectedWorkoutId(workoutId);
    setIsWorkoutPickerOpen(false);
  }

  function handleResumeDraft() {
    if (!savedWorkoutDraft) {
      return;
    }

    setDraftExercises(cloneWorkoutDraft(savedWorkoutDraft.exercises));
    setIsDraftActive(true);
  }

  function handleFinishLater() {
    if (!isDraftDirty) {
      return;
    }

    const nextDraft = {
      date: selectedDate,
      workoutId: selectedWorkout.id,
      workoutName: selectedWorkout.name,
      exercises: cloneWorkoutDraft(draftExercises),
      updatedAt: new Date().toISOString(),
    };

    saveWorkoutDraft(nextDraft);
    setSavedWorkoutDraft(nextDraft);
    setIsDraftActive(false);
    setDraftExercises(createWorkoutDraft(selectedWorkout));
  }

  function handleDiscardDraft() {
    clearWorkoutDraft(selectedDate, selectedWorkout.id);
    setSavedWorkoutDraft(null);
    setIsDraftActive(false);
    setRemovedExerciseUndo(null);
    setDraftExercises(createWorkoutDraft(selectedWorkout));
  }

  function handleUndoRemoveExercise() {
    if (!removedExerciseUndo) {
      return;
    }

    updateDraft((current) => {
      const nextDraft = [...current];
      const insertIndex = Math.min(removedExerciseUndo.index, nextDraft.length);
      nextDraft.splice(insertIndex, 0, removedExerciseUndo.exercise);
      return nextDraft;
    });
    setOpenExerciseId(removedExerciseUndo.exercise.id);
    setRemovedExerciseUndo(null);
  }

  function copySetDown(exerciseId, setIndex) {
    updateDraft((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const source = exercise.sets[setIndex];
        const target = exercise.sets[setIndex + 1];
        if (!source || !target) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((set, i) =>
            i === setIndex + 1
              ? { ...set, reps: source.reps, weight: source.weight }
              : set
          ),
        };
      })
    );
  }

  function moveSet(exerciseId, setId, direction) {
    updateDraft((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const currentIndex = exercise.sets.findIndex((set) => set.id === setId);
        if (currentIndex === -1) {
          return exercise;
        }

        const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        return {
          ...exercise,
          sets: moveItem(exercise.sets, currentIndex, nextIndex),
        };
      })
    );
  }

  // --- Custom Workout Builder ---

  function makeBuilderExercise() {
    return { id: crypto.randomUUID(), name: "", sets: 3, reps: "10-12" };
  }

  function openCustomBuilder() {
    const firstSystem = customSystems[0];
    setBuilderForm({
      systemName: firstSystem?.name || "My Workouts",
      workoutName: "",
      exercises: [makeBuilderExercise()],
    });
    setBuilderStep(1);
    setBuilderFocusId(null);
    setBuilderFocusedExId(null);
    setIsCustomBuilderOpen(true);
  }

  function handleBuilderNext() {
    if (builderStep === 1 && builderForm.workoutName.trim()) {
      setBuilderStep(2);
    } else if (builderStep === 2 && builderForm.exercises.some((e) => e.name.trim())) {
      setBuilderStep(3);
    }
  }

  function addBuilderExercise() {
    const newEx = makeBuilderExercise();
    setBuilderForm((current) => ({
      ...current,
      exercises: [...current.exercises, newEx],
    }));
    setBuilderFocusId(newEx.id);
  }

  function updateBuilderExercise(id, field, value) {
    setBuilderForm((current) => ({
      ...current,
      exercises: current.exercises.map((ex) =>
        ex.id === id ? { ...ex, [field]: value } : ex
      ),
    }));
  }

  function removeBuilderExercise(id) {
    setBuilderForm((current) => ({
      ...current,
      exercises: current.exercises.filter((ex) => ex.id !== id),
    }));
    if (builderFocusedExId === id) {
      setBuilderFocusedExId(null);
    }
  }

  function moveBuilderExercise(id, direction) {
    setBuilderForm((current) => {
      const idx = current.exercises.findIndex((ex) => ex.id === id);
      if (idx === -1) return current;
      const nextIdx = direction === "up" ? idx - 1 : idx + 1;
      return { ...current, exercises: moveItem(current.exercises, idx, nextIdx) };
    });
  }

  function applyBuilderRepChip(sets, reps) {
    setBuilderForm((current) => ({
      ...current,
      exercises: current.exercises.map((ex) =>
        builderFocusedExId ? (ex.id === builderFocusedExId ? { ...ex, sets, reps } : ex) : { ...ex, sets, reps }
      ),
    }));
  }

  function handleBuilderSave() {
    if (!builderForm) return;
    const validExercises = builderForm.exercises.filter((e) => e.name.trim());
    if (!builderForm.workoutName.trim() || !validExercises.length) return;

    const systemName = builderForm.systemName.trim() || "My Workouts";
    const workoutName = builderForm.workoutName.trim();
    const newWorkoutId = crypto.randomUUID();

    const newWorkout = {
      id: newWorkoutId,
      name: workoutName,
      summary: validExercises
        .slice(0, 3)
        .map((e) => e.name.trim())
        .join(", "),
      exercises: validExercises.map((e) => ({
        name: e.name.trim(),
        target: `${e.sets} × ${e.reps || "open"}`,
        defaultSets: e.sets,
        notes: "",
      })),
    };

    const existingSystem = customSystems.find(
      (s) => s.name.toLowerCase() === systemName.toLowerCase()
    );
    const systemId = existingSystem?.id || crypto.randomUUID();
    const existingWorkouts = existingSystem?.workouts || [];

    onSaveSystem({
      id: systemId,
      name: systemName,
      description: "Custom workout system",
      isCustom: true,
      workouts: [newWorkout, ...existingWorkouts],
    });

    // Navigate directly to the new workout (new workout is first, so the
    // selectedProgramId effect will set selectedWorkoutId to newWorkoutId)
    setSelectedProgramId(systemId);
    setSelectedPhaseId(null);
    setIsProgramPickerOpen(false);
    setIsCustomBuilderOpen(false);
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
              Growth Metrics
            </button>
          </div>
        </div>

        <div className="workout-selector-grid">
          <button
            type="button"
            className="summary-panel workout-selector-card"
            onClick={() => setIsProgramPickerOpen(true)}
          >
            <span>Program</span>
            <strong>{selectedProgram.name}</strong>
            <p className="muted">{selectedPhase ? selectedPhase.name : "Tap to choose"}</p>
          </button>
          <button
            type="button"
            className="summary-panel workout-selector-card"
            onClick={() => setIsWorkoutPickerOpen(true)}
          >
            <span>Workout</span>
            <strong>{selectedWorkout.name}</strong>
            <p className="muted">
              {selectedWorkout.summary || "Switching workouts reloads the active template automatically."}
            </p>
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rest timer</p>
            <h2>Open a floating timer while you log</h2>
          </div>
          <p className="muted">Open it once, then scroll the workout with the timer pinned at the top.</p>
        </div>

        <button
          type="button"
          className="summary-panel workout-timer-launcher"
          onClick={() => setIsTimerOpen(true)}
        >
          <div>
            <span>Current timer</span>
            <strong>{formatTimer(timeLeft)}</strong>
            <p className="muted">Preset: {restDuration / 60}m</p>
          </div>
          <div className="workout-timer-launcher__meta">
            <span>{isTimerRunning ? "Running" : "Ready"}</span>
            <strong>Open timer</strong>
          </div>
        </button>
      </section>

      {isTimerOpen ? (
        <div className="workout-timer-float" role="dialog" aria-label="Rest timer" ref={timerFloatRef}>
          <div className="timer-panel workout-timer-float__panel">
            <div className="workout-timer-float__header">
              <div>
                <p className="eyebrow">Rest timer</p>
                <strong className="timer-readout">{formatTimer(timeLeft)}</strong>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsTimerOpen(false)}
              >
                Close
              </button>
            </div>
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
                    ensureAudioContext(audioContextRef);
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
                onClick={() => {
                  ensureAudioContext(audioContextRef);
                  setIsTimerRunning((current) => !current);
                }}
              >
                {isTimerRunning ? "Pause" : "Start"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  ensureAudioContext(audioContextRef);
                  setTimeLeft(restDuration);
                  setIsTimerRunning(false);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

        {savedWorkoutDraft && !isDraftActive ? (
          <div className="summary-panel">
            <span>Saved draft available</span>
            <strong>{savedWorkoutDraft.workoutName}</strong>
            <p className="muted">
              Last saved {formatDateTime(savedWorkoutDraft.updatedAt)}. Resume where you left off or
              discard it.
            </p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={handleResumeDraft}>
                Resume draft
              </button>
              <button type="button" className="secondary-button" onClick={handleDiscardDraft}>
                Discard draft
              </button>
            </div>
          </div>
        ) : null}

        {isDraftActive && isDraftDirty ? (
          <div className="summary-panel">
            <span>Draft status</span>
            <strong>Saved automatically</strong>
            <p className="muted">
              Your progress for {formatLongDate(selectedDate)} is being kept as you build.
            </p>
          </div>
        ) : null}

        {removedExerciseUndo ? (
          <div className="summary-panel">
            <span>Exercise removed</span>
            <strong>{removedExerciseUndo.exercise.name || "Custom exercise"}</strong>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={handleUndoRemoveExercise}>
                Undo remove
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setRemovedExerciseUndo(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsCustomExerciseModalOpen(true)}
          >
            Add custom exercise
          </button>
        </div>

        <div className="list-stack">
          {draftExercises.map((exercise, exerciseIndex) => {
            const previousExercise = previousExerciseMap.get(
              normalizeExerciseName(exercise.name)
            );
            const isExpanded = openExerciseId === exercise.id;

            return (
            <article
              className="exercise-card"
              key={exercise.id}
              ref={(el) => { exerciseCardRefs.current[exercise.id] = el; }}
            >
              <button
                type="button"
                className="exercise-card__toggle"
                onClick={() => setOpenExerciseId((current) => (current === exercise.id ? null : exercise.id))}
                aria-expanded={isExpanded}
              >
                <div className="exercise-title-group">
                  <span className="exercise-index">{exerciseIndex + 1}</span>
                  <div className="exercise-card__summary">
                    <strong>{exercise.name || `Exercise ${exerciseIndex + 1}`}</strong>
                    <span>{exercise.target || "Tap to log sets"}</span>
                    {exercise.notes ? <p className="muted">{exercise.notes}</p> : null}
                  </div>
                </div>
                <span className="exercise-card__chevron">{isExpanded ? "−" : "+"}</span>
              </button>

              {isExpanded ? (
                <>
                  <div className="exercise-card__editor">
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

                  <div className="workout-inline-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => moveExercise(exercise.id, "up")}
                      disabled={exerciseIndex === 0}
                      aria-label={`Move ${exercise.name || `exercise ${exerciseIndex + 1}`} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => moveExercise(exercise.id, "down")}
                      disabled={exerciseIndex === draftExercises.length - 1}
                      aria-label={`Move ${exercise.name || `exercise ${exerciseIndex + 1}`} down`}
                    >
                      ↓
                    </button>
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
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder={
                              previousExercise?.sets?.[setIndex]?.reps !== undefined
                                ? `Last: ${previousExercise.sets[setIndex].reps}`
                                : "Reps"
                            }
                            value={set.reps}
                            onChange={(event) =>
                              updateSet(exercise.id, set.id, "reps", event.target.value)
                            }
                          />
                        </div>
                        <div className="set-field">
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            placeholder={
                              previousExercise?.sets?.[setIndex]?.weight !== undefined
                                ? `Last: ${previousExercise.sets[setIndex].weight}`
                                : "Weight"
                            }
                            value={set.weight}
                            onChange={(event) =>
                              updateSet(exercise.id, set.id, "weight", event.target.value)
                            }
                          />
                        </div>
                        <div className="set-row-actions">
                          <button
                            type="button"
                            className="secondary-button set-copy-down-btn"
                            onClick={() => copySetDown(exercise.id, setIndex)}
                            disabled={
                              setIndex === exercise.sets.length - 1 ||
                              (!set.reps && !set.weight)
                            }
                            aria-label={`Copy set ${setIndex + 1} down to set ${setIndex + 2}`}
                            title="Copy reps & weight to next set"
                          >
                            Copy ↓
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => moveSet(exercise.id, set.id, "up")}
                            disabled={setIndex === 0}
                            aria-label={`Move set ${setIndex + 1} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => moveSet(exercise.id, set.id, "down")}
                            disabled={setIndex === exercise.sets.length - 1}
                            aria-label={`Move set ${setIndex + 1} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => removeSet(exercise.id, set.id)}
                            aria-label={`Remove set ${setIndex + 1}`}
                          >
                            X
                          </button>
                        </div>
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
                </>
              ) : (
                <div className="exercise-card__collapsed-meta">
                  <span>{exercise.sets.length} planned sets</span>
                  <span>
                    {exercise.sets.some((set) => set.reps || set.weight) ? "In progress" : "Tap to log"}
                  </span>
                </div>
              )}
            </article>
          )})}
        </div>

        <div className="button-row">
          <button type="button" className="primary-button" onClick={handleSaveWorkout}>
            Save completed workout
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleFinishLater}
            disabled={!isDraftDirty}
          >
            Finish later
          </button>
        </div>
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
              const isOpen = openHistoryEntryId === entry.id;

              return (
                <article className="log-card" key={entry.id}>
                  <button
                    type="button"
                    className="log-card__toggle"
                    onClick={() =>
                      setOpenHistoryEntryId((current) =>
                        current === entry.id ? null : entry.id
                      )
                    }
                    aria-expanded={isOpen}
                  >
                    <div className="log-card__top">
                      <div>
                        <h3>{entry.workoutName}</h3>
                        <p className="muted">
                          {entry.systemName} • {formatLongDate(entry.date)}
                        </p>
                      </div>
                      <div className="log-card__meta">
                        <span>{summary.totalSets} sets</span>
                        <span className="exercise-card__chevron">{isOpen ? "−" : "+"}</span>
                      </div>
                    </div>
                    {!isOpen && (
                      <p className="muted log-card__volume">
                        {entry.exercises.length} exercise{entry.exercises.length !== 1 ? "s" : ""} • {Math.round(summary.totalVolume)} total volume
                      </p>
                    )}
                  </button>
                  {isOpen && (
                    <>
                      <div className="exercise-history-list">
                        {entry.exercises.map((exercise) => (
                          <div className="exercise-history-row" key={`${entry.id}-${exercise.name}`}>
                            <span>{exercise.name}</span>
                            <span>
                              {exercise.sets
                                .map((set) => `${set.reps} × ${set.weight}`)
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
                    </>
                  )}
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
                const isOpen = openHistoryEntryId === entry.id;

                return (
                  <article className="log-card" key={entry.id}>
                    <button
                      type="button"
                      className="log-card__toggle"
                      onClick={() =>
                        setOpenHistoryEntryId((current) =>
                          current === entry.id ? null : entry.id
                        )
                      }
                      aria-expanded={isOpen}
                    >
                      <div className="log-card__top">
                        <div>
                          <h3>{entry.workoutName}</h3>
                          <p className="muted">{formatLongDate(entry.date)}</p>
                        </div>
                        <div className="log-card__meta">
                          <span>{summary.totalSets} sets</span>
                          <span className="exercise-card__chevron">{isOpen ? "−" : "+"}</span>
                        </div>
                      </div>
                      {!isOpen && (
                        <p className="muted log-card__volume">{entry.systemName}</p>
                      )}
                    </button>
                    {isOpen && (
                      <div className="exercise-history-list">
                        {entry.exercises.map((exercise) => (
                          <div className="exercise-history-row" key={`${entry.id}-${exercise.name}`}>
                            <span>{exercise.name}</span>
                            <span>
                              {exercise.sets
                                .map((set) => `${set.reps} × ${set.weight}`)
                                .join(" • ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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
                <h2 id="workout-insights-title">Growth Metrics</h2>
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

      {isProgramPickerOpen ? (
        <div
          className="insights-modal-backdrop"
          role="presentation"
          onClick={() => setIsProgramPickerOpen(false)}
        >
          <section
            className="insights-modal workout-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-program-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Workout tracking</p>
                <h2 id="workout-program-picker-title">Select program</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsProgramPickerOpen(false)}
              >
                Close
              </button>
            </div>

            <p className="muted">
              Pick the training system first, then choose a mesocycle block if that program uses
              phases.
            </p>

            <div className="workout-system-grid">
              {workoutPrograms.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  className={
                    program.id === selectedProgramId
                      ? "workout-chip workout-chip--selected"
                      : "workout-chip"
                  }
                  onClick={() => handleProgramChange(program.id)}
                >
                  <strong>{program.name}</strong>
                  <span>{program.description || "Workout program"}</span>
                </button>
              ))}
              <button
                type="button"
                className="workout-chip builder-create-chip"
                onClick={openCustomBuilder}
              >
                <strong>+ Build Custom Workout</strong>
                <span>Design your own exercises, sets &amp; reps</span>
              </button>
            </div>

            {selectedProgram.phases?.length ? (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Mesocycle block</p>
                    <h2>Choose block</h2>
                  </div>
                  <p className="muted">This determines which workout list is available next.</p>
                </div>
                <div className="workout-system-grid">
                  {selectedProgram.phases.map((phase) => (
                    <button
                      key={phase.id}
                      type="button"
                      className={
                        phase.id === selectedPhaseId
                          ? "workout-chip workout-chip--selected"
                          : "workout-chip"
                      }
                      onClick={() => handlePhaseChange(phase.id)}
                    >
                      <strong>{phase.name}</strong>
                      <span>{phase.summary}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {isWorkoutPickerOpen ? (
        <div
          className="insights-modal-backdrop"
          role="presentation"
          onClick={() => setIsWorkoutPickerOpen(false)}
        >
          <section
            className="insights-modal workout-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Workout tracking</p>
                <h2 id="workout-picker-title">Select workout</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsWorkoutPickerOpen(false)}
              >
                Close
              </button>
            </div>

            <p className="muted">
              {selectedPhase ? `${selectedProgram.name} • ${selectedPhase.name}` : selectedProgram.name}
            </p>

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
                  onClick={() => handleWorkoutChange(workout.id)}
                >
                  <strong>{workout.name}</strong>
                  <span>{workout.phaseSummary || workout.summary}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isCustomExerciseModalOpen ? (
        <div
          className="insights-modal-backdrop"
          role="presentation"
          onClick={() => {
            setIsCustomExerciseModalOpen(false);
            resetCustomExerciseForm();
          }}
        >
          <section
            className="insights-modal workout-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-exercise-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Workout tracking</p>
                <h2 id="custom-exercise-title">Add custom exercise</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsCustomExerciseModalOpen(false);
                  resetCustomExerciseForm();
                }}
              >
                Close
              </button>
            </div>

            <p className="muted">
              This adds an exercise only to today&apos;s workout. It does not modify the workout
              program template.
            </p>

            <div className="compact-grid compact-grid--two">
              <label>
                Exercise name
                <input
                  value={customExerciseForm.name}
                  onChange={(event) =>
                    setCustomExerciseForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Cable fly"
                />
              </label>
              <label>
                Number of sets
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customExerciseForm.setCount}
                  onChange={(event) =>
                    setCustomExerciseForm((current) => ({
                      ...current,
                      setCount: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Target
              <input
                value={customExerciseForm.target}
                onChange={(event) =>
                  setCustomExerciseForm((current) => ({ ...current, target: event.target.value }))
                }
                placeholder="3 x 10-12"
              />
            </label>

            <label className="custom-exercise-save-toggle">
              <input
                type="checkbox"
                checked={customExerciseForm.saveToBank}
                onChange={(event) =>
                  setCustomExerciseForm((current) => ({
                    ...current,
                    saveToBank: event.target.checked,
                  }))
                }
              />
              <span>Save to my exercise bank for later</span>
            </label>

            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={handleApplyCustomExercise}
                disabled={!customExerciseForm.name.trim()}
              >
                Apply
              </button>
            </div>

            <div className="section-heading">
              <div>
                <p className="eyebrow">Saved exercises</p>
                <h2>Exercise bank</h2>
              </div>
              <p className="muted">Reuse your custom lifts without typing them again.</p>
            </div>

            {customExerciseBank.length ? (
              <div className="list-stack">
                {customExerciseBank.map((exercise) => (
                  <article className="log-card" key={exercise.id}>
                    <div className="log-card__top">
                      <div>
                        <h3>{exercise.name}</h3>
                        <p className="muted">
                          {exercise.target} • {exercise.setCount} sets
                        </p>
                      </div>
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleUseSavedCustomExercise(exercise)}
                      >
                        Add to today&apos;s workout
                      </button>
                      <button
                        type="button"
                        className="secondary-button danger-button"
                        onClick={() => handleDeleteSavedCustomExercise(exercise.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-panel">
                <p>No saved custom exercises yet.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {isCustomBuilderOpen && builderForm ? (
        <div
          className="insights-modal-backdrop"
          role="presentation"
          onClick={() => setIsCustomBuilderOpen(false)}
        >
          <section
            className="insights-modal builder-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="builder-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Custom Workout</p>
                <h2 id="builder-modal-title">
                  {builderStep === 1
                    ? "Name your workout"
                    : builderStep === 2
                    ? "Add exercises"
                    : "Review & save"}
                </h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsCustomBuilderOpen(false)}
              >
                Cancel
              </button>
            </div>

            <div className="builder-steps">
              {["Name", "Exercises", "Review"].map((label, i) => {
                const stepNum = i + 1;
                const isActive = stepNum === builderStep;
                const isDone = stepNum < builderStep;
                return (
                  <div
                    key={label}
                    className={[
                      "builder-step",
                      isActive ? "builder-step--active" : "",
                      isDone ? "builder-step--done" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {i > 0 && <div className="builder-step__line" />}
                    <div className="builder-step__circle">{isDone ? "✓" : stepNum}</div>
                    <span className="builder-step__label">{label}</span>
                  </div>
                );
              })}
            </div>

            {builderStep === 1 ? (
              <div className="form-grid">
                <label>
                  Workout name
                  <input
                    autoFocus
                    value={builderForm.workoutName}
                    onChange={(e) =>
                      setBuilderForm((f) => ({ ...f, workoutName: e.target.value }))
                    }
                    placeholder="Push Day, Upper A, Leg Day…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleBuilderNext();
                    }}
                  />
                </label>
                <label>
                  Program group
                  <input
                    value={builderForm.systemName}
                    onChange={(e) =>
                      setBuilderForm((f) => ({ ...f, systemName: e.target.value }))
                    }
                    placeholder="My Workouts"
                  />
                </label>
                {customSystems.length > 0 ? (
                  <div>
                    <p className="muted" style={{ margin: "0 0 8px" }}>
                      Or add to an existing group:
                    </p>
                    <div className="builder-chip-group">
                      {customSystems.map((sys) => (
                        <button
                          key={sys.id}
                          type="button"
                          className={[
                            "builder-chip",
                            builderForm.systemName.toLowerCase() === sys.name.toLowerCase()
                              ? "builder-chip--selected"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() =>
                            setBuilderForm((f) => ({ ...f, systemName: sys.name }))
                          }
                        >
                          {sys.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleBuilderNext}
                    disabled={!builderForm.workoutName.trim()}
                  >
                    Next: Add exercises
                  </button>
                </div>
              </div>
            ) : null}

            {builderStep === 2 ? (
              <>
                <div className="builder-exercise-meta">
                  <span className="eyebrow">
                    {builderForm.exercises.filter((e) => e.name.trim()).length} exercise
                    {builderForm.exercises.filter((e) => e.name.trim()).length !== 1 ? "s" : ""}
                    {" added"}
                  </span>
                </div>

                <div className="builder-chip-group">
                  <span className="builder-chip-label">Set all:</span>
                  {[
                    { label: "5×5", sets: 5, reps: "5" },
                    { label: "4×6", sets: 4, reps: "6" },
                    { label: "3×8", sets: 3, reps: "8" },
                    { label: "3×10", sets: 3, reps: "10-12" },
                    { label: "3×12", sets: 3, reps: "12-15" },
                    { label: "AMRAP", sets: 3, reps: "AMRAP" },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      className="builder-chip"
                      onClick={() => applyBuilderRepChip(chip.sets, chip.reps)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <div className="list-stack">
                  {builderForm.exercises.map((ex, idx) => (
                    <div className="builder-exercise-row" key={ex.id}>
                      <span className="exercise-index">{idx + 1}</span>
                      <input
                        ref={(el) => {
                          builderExerciseRefs.current[ex.id] = el;
                        }}
                        className="builder-exercise-name"
                        value={ex.name}
                        onChange={(e) => updateBuilderExercise(ex.id, "name", e.target.value)}
                        onFocus={() => setBuilderFocusedExId(ex.id)}
                        onBlur={() => setBuilderFocusedExId(null)}
                        placeholder={`Exercise ${idx + 1}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (idx === builderForm.exercises.length - 1) {
                              addBuilderExercise();
                            } else {
                              const nextEx = builderForm.exercises[idx + 1];
                              builderExerciseRefs.current[nextEx.id]?.focus();
                            }
                          }
                        }}
                      />
                      <div className="builder-sets-stepper">
                        <button
                          type="button"
                          onClick={() =>
                            updateBuilderExercise(ex.id, "sets", Math.max(1, ex.sets - 1))
                          }
                          aria-label="Decrease sets"
                        >
                          −
                        </button>
                        <span>{ex.sets}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateBuilderExercise(ex.id, "sets", Math.min(10, ex.sets + 1))
                          }
                          aria-label="Increase sets"
                        >
                          +
                        </button>
                      </div>
                      <input
                        className="builder-reps-input"
                        value={ex.reps}
                        onChange={(e) => updateBuilderExercise(ex.id, "reps", e.target.value)}
                        onFocus={() => setBuilderFocusedExId(ex.id)}
                        onBlur={() => setBuilderFocusedExId(null)}
                        placeholder="Reps"
                        aria-label={`Exercise ${idx + 1} reps`}
                      />
                      {builderForm.exercises.length > 1 ? (
                        <button
                          type="button"
                          className="builder-remove-btn"
                          onClick={() => removeBuilderExercise(ex.id)}
                          aria-label={`Remove exercise ${idx + 1}`}
                        >
                          ×
                        </button>
                      ) : (
                        <span className="builder-remove-placeholder" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={addBuilderExercise}
                  >
                    + Add exercise
                  </button>
                </div>

                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleBuilderNext}
                    disabled={!builderForm.exercises.some((e) => e.name.trim())}
                  >
                    Review workout
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setBuilderStep(1)}
                  >
                    Back
                  </button>
                </div>
              </>
            ) : null}

            {builderStep === 3 ? (
              <>
                <div className="summary-panel">
                  <span>Workout</span>
                  <strong>{builderForm.workoutName}</strong>
                  <p className="muted">{builderForm.systemName}</p>
                </div>

                <div className="list-stack">
                  {builderForm.exercises
                    .filter((e) => e.name.trim())
                    .map((ex, idx) => (
                      <div className="builder-review-row" key={ex.id}>
                        <span className="exercise-index">{idx + 1}</span>
                        <div className="builder-review-row__info">
                          <strong>{ex.name}</strong>
                        </div>
                        <span className="builder-review-row__target">
                          {ex.sets} × {ex.reps || "open"}
                        </span>
                      </div>
                    ))}
                </div>

                <p className="muted">
                  After saving, this workout appears in your program picker and is ready to log immediately.
                </p>

                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleBuilderSave}
                  >
                    Save workout
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setBuilderStep(2)}
                  >
                    Edit exercises
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ensureAudioContext(audioContextRef) {
  if (typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextClass();
  }

  if (audioContextRef.current.state === "suspended") {
    audioContextRef.current.resume().catch(() => {});
  }
}

function scheduleBeeps(context) {
  const startAt = context.currentTime;
  [0, 0.22, 0.44].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(index === 1 ? 1046.5 : 880, startAt + offset);
    gainNode.gain.setValueAtTime(0.0001, startAt + offset);
    gainNode.gain.exponentialRampToValueAtTime(0.18, startAt + offset + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.16);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + 0.18);
  });
}

function playTimerAlarm(audioContextRef) {
  const context = audioContextRef.current;
  if (!context) return;

  if (context.state === "suspended") {
    context.resume().then(() => scheduleBeeps(context)).catch(() => {});
  } else {
    scheduleBeeps(context);
  }
}

function loadCustomExerciseBank() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const savedValue = window.localStorage.getItem(CUSTOM_EXERCISE_BANK_KEY);
    const parsed = savedValue ? JSON.parse(savedValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomExerciseBank(exercises) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CUSTOM_EXERCISE_BANK_KEY, JSON.stringify(exercises));
  } catch {
    // Ignore custom exercise bank persistence failures.
  }
}

function upsertCustomExercise(currentBank, exercise) {
  const existing = currentBank.find(
    (entry) => entry.name.trim().toLowerCase() === exercise.name.trim().toLowerCase()
  );

  if (existing) {
    return currentBank.map((entry) =>
      entry.id === existing.id ? { ...entry, ...exercise } : entry
    );
  }

  return [{ id: crypto.randomUUID(), ...exercise }, ...currentBank];
}

function normalizeDraftForCompare(exercises) {
  return exercises.map((exercise) => ({
    name: exercise.name.trim(),
    target: (exercise.target || "").trim(),
    notes: (exercise.notes || "").trim(),
    sets: exercise.sets.map((set) => ({
      reps: String(set.reps ?? ""),
      weight: String(set.weight ?? ""),
    })),
  }));
}

function createTemplateDraftForCompare(workout) {
  return workout.exercises.map((exercise) => ({
    name: exercise.name.trim(),
    target: (exercise.target || "").trim(),
    notes: (exercise.notes || "").trim(),
    sets: Array.from({ length: exercise.defaultSets || 1 }, () => ({
      reps: "",
      weight: "",
    })),
  }));
}

function hasDraftChanges(draftExercises, workout) {
  return (
    JSON.stringify(normalizeDraftForCompare(draftExercises)) !==
    JSON.stringify(createTemplateDraftForCompare(workout))
  );
}

function cloneWorkoutDraft(exercises) {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));
}

function loadAllWorkoutDrafts() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const savedValue = window.localStorage.getItem(WORKOUT_DRAFTS_KEY);
    const parsed = savedValue ? JSON.parse(savedValue) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllWorkoutDrafts(drafts) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(WORKOUT_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore workout draft persistence failures.
  }
}

function getWorkoutDraftKey(date, workoutId) {
  return `${date}::${workoutId}`;
}

function loadWorkoutDraft(date, workoutId) {
  const drafts = loadAllWorkoutDrafts();
  return drafts[getWorkoutDraftKey(date, workoutId)] || null;
}

function saveWorkoutDraft(draft) {
  const drafts = loadAllWorkoutDrafts();
  drafts[getWorkoutDraftKey(draft.date, draft.workoutId)] = draft;
  saveAllWorkoutDrafts(drafts);
}

function clearWorkoutDraft(date, workoutId) {
  const drafts = loadAllWorkoutDrafts();
  delete drafts[getWorkoutDraftKey(date, workoutId)];
  saveAllWorkoutDrafts(drafts);
}

function formatDateTime(value) {
  if (!value) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
