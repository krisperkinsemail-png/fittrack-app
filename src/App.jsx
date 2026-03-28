import { useMemo, useState } from "react";
import { DashboardSection } from "./components/DashboardSection";
import { useAuth } from "./components/AuthGate";
import { DateNavigator } from "./components/DateNavigator";
import { FoodLogSection } from "./components/FoodLogSection";
import { MobileTabs } from "./components/MobileTabs";
import { SettingsSection } from "./components/SettingsSection";
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
    addMealTemplate,
    deleteMealTemplate,
    addFoodEntries,
    addWeightEntry,
    deleteWeightEntry,
    addWorkoutEntry,
    deleteWorkoutEntry,
    saveCustomWorkoutSystem,
    deleteCustomWorkoutSystem,
    updateSettings,
    setSelectedDate,
    syncStatus,
    syncError,
    localMigrationData,
    dismissLocalMigration,
    importLocalMigration,
  } = useFitTrackStore();

  const [activeTab, setActiveTab] = useState("dashboard");
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

  const remaining = {
    calories: state.settings.calorieTarget - dailyTotals.calories,
    protein: state.settings.proteinTarget - dailyTotals.protein,
    carbs: state.settings.carbsTarget - dailyTotals.carbs,
    fat: state.settings.fatTarget - dailyTotals.fat,
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
      { current: dailyTotals.calories, target: state.settings.calorieTarget, tolerance: 0.1 },
      { current: dailyTotals.protein, target: state.settings.proteinTarget, tolerance: 0.15 },
      { current: dailyTotals.carbs, target: state.settings.carbsTarget, tolerance: 0.15 },
      { current: dailyTotals.fat, target: state.settings.fatTarget, tolerance: 0.15 },
    ];

    const metricScores = metrics.map(({ current, target, tolerance }) => {
      if (target <= 0) {
        return 100;
      }

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
  }, [dailyTotals, state.settings]);

  return (
    <div className="app-shell theme-shell" data-accent={state.settings.accentColor}>
      <header className="topbar">
        <div className="topbar-heading-row">
          <div>
            <p className="eyebrow">AI Fit</p>
            <h1>Welcome back, {firstName}.</h1>
          </div>
          <button type="button" className="secondary-button topbar-home-link" onClick={goToHomepage}>
            Homepage
          </button>
        </div>
        <p className="topbar-copy">Let&apos;s build the version of you that your future self is proud of.</p>
        <div className="accent-switcher" aria-label="Accent color">
          <button
            type="button"
            className={
              activeTab === "dashboard"
                ? "secondary-button home-button is-selected-accent"
                : "secondary-button home-button"
            }
            onClick={() => {
              setActiveTab("dashboard");
              setSelectedDate(getToday());
            }}
          >
            Today's Snapshot
          </button>
        </div>
      </header>

      <DateNavigator
        selectedDate={state.selectedDate}
        formattedDate={formatLongDate(state.selectedDate)}
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
            onAddEntry={addFoodEntry}
            onAddEntries={addFoodEntries}
            onUpdateEntry={updateFoodEntry}
            onDeleteEntry={deleteFoodEntry}
            onSaveMeal={addMealTemplate}
            onDeleteMeal={deleteMealTemplate}
          />
        </section>

        <section className={activeTab === "weight" ? "section is-active" : "section"}>
          <WeightSection
            selectedDate={state.selectedDate}
            currentEntry={selectedWeightEntry}
            entries={weightEntriesDescending.slice(0, 10)}
            settings={state.settings}
            weightTrendSummary={weightTrendSummary}
            weightGoalProgress={weightGoalProgress}
            onSaveEntry={addWeightEntry}
            onDeleteEntry={deleteWeightEntry}
          />
        </section>

        <section className={activeTab === "workouts" ? "section is-active" : "section"}>
          <WorkoutSection
            selectedDate={state.selectedDate}
            entries={selectedWorkoutEntries}
            recentEntries={state.workoutEntries.slice().sort(sortByDateDescending).slice(0, 8)}
            allEntries={state.workoutEntries}
            customSystems={state.customWorkoutSystems}
            onAddEntry={addWorkoutEntry}
            onDeleteEntry={deleteWorkoutEntry}
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
    </div>
  );
}
