import { useEffect, useMemo, useState } from "react";
import { DashboardSection } from "./components/DashboardSection";
import { useAuth } from "./components/AuthGate";
import { DateNavigator } from "./components/DateNavigator";
import { FoodLogSection } from "./components/FoodLogSection";
import { MobileTabs } from "./components/MobileTabs";
import { FeedbackModal, SettingsSection } from "./components/SettingsSection";
import { WeightSection } from "./components/WeightSection";
import { WorkoutSection } from "./components/WorkoutSection";
import { useFitTrackStore } from "./hooks/useFitTrackStore";
import {
  addDays,
  formatLongDate,
  getLatestWeightEntry,
  getToday,
  isSameDate,
  sortByDateDescending,
} from "./lib/date";
import { getWeightGoalProgress, getWeightTrendSummary } from "./lib/weightTrend";

const TABS = [
  { id: "food", label: "Food" },
  { id: "weight", label: "Weight" },
  { id: "workouts", label: "Workouts" },
  { id: "settings", label: "Goals" },
];

export default function App() {
  const { goToHomepage, session } = useAuth();
  const {
    state,
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    restoreFoodEntry,
    addMealTemplate,
    deleteMealTemplate,
    addFoodEntries,
    addWeightEntry,
    deleteWeightEntry,
    restoreWeightEntry,
    addWaterEntry,
    deleteWaterEntry,
    addWorkoutEntry,
    deleteWorkoutEntry,
    restoreWorkoutEntry,
    updateWorkoutEntry,
    saveCustomWorkoutSystem,
    deleteCustomWorkoutSystem,
    updateSettings,
    setSelectedDate,
    syncStatus,
    syncError,
    lastSyncedAt,
    localMigrationData,
    dismissLocalMigration,
    importLocalMigration,
  } = useFitTrackStore();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [undoToast, setUndoToast] = useState(null);
  const firstName = useMemo(() => {
    const metadataName = session?.user?.user_metadata?.first_name || session?.user?.user_metadata?.name;
    if (metadataName) {
      return String(metadataName).trim().split(/\s+/)[0];
    }

    const emailName = session?.user?.email?.split("@")[0] || "";
    if (!emailName) {
      return "there";
    }

    const cleaned = emailName.replace(/[._-]+/g, " ").trim();
    const firstPart = cleaned.split(/\s+/)[0] || "there";
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
  }, [session]);

  const selectedFoodEntries = useMemo(
    () =>
      state.foodEntries
        .filter((entry) => isSameDate(entry.date, state.selectedDate))
        .sort(sortByDateDescending),
    [state.foodEntries, state.selectedDate]
  );

  const selectedWorkoutEntries = useMemo(
    () =>
      state.workoutEntries
        .filter((entry) => isSameDate(entry.date, state.selectedDate))
        .sort(sortByDateDescending),
    [state.workoutEntries, state.selectedDate]
  );

  const weightEntriesDescending = useMemo(
    () => [...state.weightEntries].sort(sortByDateDescending),
    [state.weightEntries]
  );

  const selectedWeightEntry = useMemo(
    () => state.weightEntries.find((entry) => isSameDate(entry.date, state.selectedDate)) || null,
    [state.weightEntries, state.selectedDate]
  );

  const selectedWaterEntry = useMemo(
    () => state.waterEntries.find((entry) => isSameDate(entry.date, state.selectedDate)) || null,
    [state.waterEntries, state.selectedDate]
  );

  const dailyTotals = useMemo(() => {
    return selectedFoodEntries.reduce(
      (totals, entry) => ({
        calories: totals.calories + entry.calories,
        protein: totals.protein + entry.protein,
        carbs: totals.carbs + entry.carbs,
        fat: totals.fat + entry.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [selectedFoodEntries]);

  const numericTargets = useMemo(
    () => ({
      calories: Number(state.settings.calorieTarget) || 0,
      protein: Number(state.settings.proteinTarget) || 0,
      carbs: Number(state.settings.carbsTarget) || 0,
      fat: Number(state.settings.fatTarget) || 0,
    }),
    [state.settings]
  );

  const remaining = {
    calories: numericTargets.calories > 0 ? numericTargets.calories - dailyTotals.calories : null,
    protein: numericTargets.protein > 0 ? numericTargets.protein - dailyTotals.protein : null,
    carbs: numericTargets.carbs > 0 ? numericTargets.carbs - dailyTotals.carbs : null,
    fat: numericTargets.fat > 0 ? numericTargets.fat - dailyTotals.fat : null,
  };

  const latestWeight = getLatestWeightEntry(state.weightEntries);
  const weightTrendSummary = useMemo(
    () => getWeightTrendSummary(state.weightEntries),
    [state.weightEntries]
  );
  const weightGoalProgress = useMemo(
    () => getWeightGoalProgress(state.weightEntries, state.settings.weightGoal),
    [state.weightEntries, state.settings.weightGoal]
  );
  const complianceSummary = useMemo(() => {
    const metrics = [
      { current: dailyTotals.calories, target: numericTargets.calories, tolerance: 0.1 },
      { current: dailyTotals.protein, target: numericTargets.protein, tolerance: 0.15 },
      { current: dailyTotals.carbs, target: numericTargets.carbs, tolerance: 0.15 },
      { current: dailyTotals.fat, target: numericTargets.fat, tolerance: 0.15 },
    ];

    const activeMetrics = metrics.filter(({ target }) => target > 0);

    if (!activeMetrics.length) {
      return {
        score: 0,
        label: "Set targets",
      };
    }

    const metricScores = activeMetrics.map(({ current, target, tolerance }) => {
      const deltaRatio = Math.abs(current - target) / target;
      return Math.max(0, Math.round((1 - deltaRatio / tolerance) * 100));
    });

    const score = Math.round(
      metricScores.reduce((sum, metricScore) => sum + metricScore, 0) / metricScores.length
    );

    return {
      score,
      label: score >= 85 ? "On target" : score >= 60 ? "Close" : "Needs adjustment",
    };
  }, [dailyTotals, numericTargets]);

  useEffect(() => {
    if (!undoToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setUndoToast(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [undoToast]);

  const nutritionAverages = useMemo(() => {
    const dateKeys = Array.from({ length: 7 }, (_, index) => addDays(state.selectedDate, index - 6));
    const totalsByDate = new Map(
      dateKeys.map((date) => [
        date,
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ])
    );

    state.foodEntries.forEach((entry) => {
      if (!totalsByDate.has(entry.date)) {
        return;
      }

      const current = totalsByDate.get(entry.date);
      totalsByDate.set(entry.date, {
        calories: current.calories + entry.calories,
        protein: current.protein + entry.protein,
        carbs: current.carbs + entry.carbs,
        fat: current.fat + entry.fat,
      });
    });

    const sums = [...totalsByDate.values()].reduce(
      (totals, dayTotals) => ({
        calories: totals.calories + dayTotals.calories,
        protein: totals.protein + dayTotals.protein,
        carbs: totals.carbs + dayTotals.carbs,
        fat: totals.fat + dayTotals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const yesterdayDate = addDays(state.selectedDate, -1);
    const yesterdayTotals = totalsByDate.get(yesterdayDate) || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    return {
      weeklyAverage: {
        calories: sums.calories / 7,
        protein: sums.protein / 7,
        carbs: sums.carbs / 7,
        fat: sums.fat / 7,
      },
      yesterdayDate,
      yesterdayTotals,
    };
  }, [state.foodEntries, state.selectedDate]);

  const workoutSnapshot = useMemo(() => {
    const eligibleEntries = state.workoutEntries
      .filter((entry) => entry.date <= state.selectedDate)
      .sort(sortByDateDescending);
    const last30Entries = eligibleEntries.filter((entry) => {
      const dayDiff = Math.floor(
        (new Date(`${state.selectedDate}T12:00:00`) - new Date(`${entry.date}T12:00:00`)) /
          (24 * 60 * 60 * 1000)
      );
      return dayDiff >= 0 && dayDiff < 30;
    });

    const strongestSet = eligibleEntries
      .flatMap((entry) =>
        entry.exercises.flatMap((exercise) =>
          exercise.sets.map((set) => ({
            exerciseName: exercise.name,
            weight: Number(set.weight || 0),
            reps: Number(set.reps || 0),
            date: entry.date,
          }))
        )
      )
      .filter((set) => Number.isFinite(set.weight) && set.weight > 0)
      .sort((left, right) => right.weight - left.weight)[0] || null;

    const uniqueExercises = new Set(
      last30Entries.flatMap((entry) => entry.exercises.map((exercise) => exercise.name.trim().toLowerCase()))
    );

    return {
      lastWorkout: eligibleEntries[0] || null,
      sessionsLast30: last30Entries.length,
      totalSetsLast30: last30Entries.reduce(
        (sum, entry) => sum + entry.exercises.reduce((exerciseSum, exercise) => exerciseSum + exercise.sets.length, 0),
        0
      ),
      uniqueExercisesLast30: uniqueExercises.size,
      strongestSet,
    };
  }, [state.selectedDate, state.workoutEntries]);

  function showUndoToast(message, onUndo) {
    setUndoToast({
      message,
      onUndo,
    });
  }

  function handleDeleteFoodEntry(id) {
    const deletedEntry = state.foodEntries.find((entry) => entry.id === id);
    if (!deletedEntry) {
      return;
    }

    deleteFoodEntry(id);
    showUndoToast(`Deleted ${deletedEntry.name}`, () => restoreFoodEntry(deletedEntry));
  }

  function handleDeleteWeightEntry(id) {
    const deletedEntry = state.weightEntries.find((entry) => entry.id === id);
    if (!deletedEntry) {
      return;
    }

    deleteWeightEntry(id);
    showUndoToast(`Deleted weight for ${deletedEntry.date}`, () => restoreWeightEntry(deletedEntry));
  }

  function handleDeleteWorkoutEntry(id) {
    const deletedEntry = state.workoutEntries.find((entry) => entry.id === id);
    if (!deletedEntry) {
      return;
    }

    deleteWorkoutEntry(id);
    showUndoToast(`Deleted ${deletedEntry.workoutName}`, () => restoreWorkoutEntry(deletedEntry));
  }

  const formattedLastSyncedAt = useMemo(() => {
    if (!lastSyncedAt) {
      return null;
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(lastSyncedAt);
  }, [lastSyncedAt]);

  return (
    <div className="app-shell theme-shell" data-accent={state.settings.accentColor}>
      <header className="topbar">
        <div className="topbar-heading-row">
          <div>
            <p className="eyebrow">AI Fit</p>
            <h1>Welcome back, {firstName}.</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="secondary-button topbar-home-link" onClick={goToHomepage}>
              Homepage
            </button>
            <button
              type="button"
              className="secondary-button topbar-icon-button"
              aria-label="Feedback / Report Issue"
              title="Feedback / Report Issue"
              onClick={() => setIsFeedbackOpen(true)}
            >
              ?
            </button>
          </div>
        </div>
        <p className="topbar-copy">Let&apos;s get started!</p>
        <div className="accent-switcher" aria-label="Accent color">
          <button
            type="button"
            className={
              activeTab === "dashboard"
                ? "secondary-button home-button is-selected-accent"
                : "secondary-button home-button"
            }
            onClick={() => setActiveTab("dashboard")}
          >
            Data Snapshot
          </button>
        </div>
      </header>

      <DateNavigator
        selectedDate={state.selectedDate}
        formattedDate={formatLongDate(state.selectedDate)}
        isTodaySelected={state.selectedDate === getToday()}
        onPrevious={() => setSelectedDate(addDays(state.selectedDate, -1))}
        onNext={() => setSelectedDate(addDays(state.selectedDate, 1))}
        onToday={() => setSelectedDate(getToday())}
      />

      {localMigrationData ? (
        <section className="card sync-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Migration available</p>
              <h2>Import your old local data</h2>
            </div>
            <p className="muted">
              We found device-only data that is not yet in your cloud account.
            </p>
          </div>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={importLocalMigration}>
              Import local data
            </button>
            <button type="button" className="secondary-button" onClick={dismissLocalMigration}>
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      <MobileTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        userEmail={session?.user?.email || ""}
        activeTab={activeTab}
        selectedDate={state.selectedDate}
      />

      <main className="content-grid">
        <section className={activeTab === "dashboard" ? "section is-active" : "section"}>
          <div className="section-stack">
            <DashboardSection
              selectedDate={state.selectedDate}
              formattedDate={formatLongDate(state.selectedDate)}
              dailyTotals={dailyTotals}
              remaining={remaining}
              settings={state.settings}
              latestWeight={latestWeight}
              weightTrendSummary={weightTrendSummary}
              weightGoalProgress={weightGoalProgress}
              complianceSummary={complianceSummary}
              nutritionAverages={nutritionAverages}
              workoutSnapshot={workoutSnapshot}
              onUpdateSettings={updateSettings}
            />
            {syncStatus !== "local" ? (
              <section className="card sync-card">
                <div className="sync-row">
                  <strong>
                    {syncStatus === "saving"
                      ? "Cloud sync in progress"
                      : syncStatus === "synced"
                        ? "Cloud sync active"
                        : "Cloud sync issue"}
                  </strong>
                  <span className={syncStatus === "error" ? "sync-pill sync-pill--error" : "sync-pill"}>
                    {syncStatus}
                  </span>
                </div>
                {syncError ? <p className="muted">{syncError}</p> : null}
                {formattedLastSyncedAt ? (
                  <p className="muted">Last synced {formattedLastSyncedAt}</p>
                ) : null}
              </section>
            ) : null}
          </div>
        </section>

        <section className={activeTab === "food" ? "section is-active" : "section"}>
          <FoodLogSection
            selectedDate={state.selectedDate}
            entries={selectedFoodEntries}
            mealTemplates={state.mealTemplates}
            allEntries={state.foodEntries}
            waterOunces={selectedWaterEntry?.ounces || 0}
            onAddEntry={addFoodEntry}
            onAddEntries={addFoodEntries}
            onUpdateEntry={updateFoodEntry}
            onDeleteEntry={handleDeleteFoodEntry}
            onSaveMeal={addMealTemplate}
            onDeleteMeal={deleteMealTemplate}
            onAddWater={(ounces) => addWaterEntry({ date: state.selectedDate, ounces })}
            onResetWater={() => deleteWaterEntry(state.selectedDate)}
          />
        </section>

        <section className={activeTab === "weight" ? "section is-active" : "section"}>
          <WeightSection
            selectedDate={state.selectedDate}
            currentEntry={selectedWeightEntry}
            entries={weightEntriesDescending}
            settings={state.settings}
            weightTrendSummary={weightTrendSummary}
            weightGoalProgress={weightGoalProgress}
            onSaveEntry={addWeightEntry}
            onDeleteEntry={handleDeleteWeightEntry}
          />
        </section>

        <section className={activeTab === "workouts" ? "section is-active" : "section"}>
          <WorkoutSection
            selectedDate={state.selectedDate}
            entries={selectedWorkoutEntries}
            recentEntries={state.workoutEntries.slice().sort(sortByDateDescending).slice(0, 8)}
            allEntries={state.workoutEntries}
            customSystems={state.customWorkoutSystems}
            preferredProgramId={state.settings.lastSelectedWorkoutProgramId}
            onAddEntry={addWorkoutEntry}
            onDeleteEntry={handleDeleteWorkoutEntry}
            onUpdateEntry={updateWorkoutEntry}
            onSetSelectedDate={setSelectedDate}
            onSavePreferredProgramId={(programId) =>
              updateSettings({ lastSelectedWorkoutProgramId: programId })
            }
            onSaveSystem={saveCustomWorkoutSystem}
            onDeleteSystem={deleteCustomWorkoutSystem}
          />
        </section>

        <section className={activeTab === "settings" ? "section is-active" : "section"}>
          <SettingsSection
            settings={state.settings}
            onSave={updateSettings}
            syncStatus={syncStatus}
            syncError={syncError}
          />
        </section>
      </main>

      {undoToast ? (
        <div className="undo-toast" role="status" aria-live="polite">
          <p>{undoToast.message}</p>
          <div className="undo-toast__actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                undoToast.onUndo();
                setUndoToast(null);
              }}
            >
              Undo
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setUndoToast(null)}
              aria-label="Dismiss undo message"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
