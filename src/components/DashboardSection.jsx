import { WeightTrendChart } from "./WeightTrendChart";

function formatMetricValue(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatRemaining(value, unit) {
  const formattedValue = formatMetricValue(Math.abs(value));

  if (value >= 0) {
    return `${formattedValue} ${unit} left`;
  }

  return `${formattedValue} ${unit} over`;
}

function formatDelta(value, unit) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  if (rounded === 0) {
    return `Same as yesterday`;
  }

  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${unit} vs yesterday`;
}

export function DashboardSection({
  selectedDate,
  formattedDate,
  dailyTotals,
  remaining,
  settings,
  latestWeight,
  weightTrendSummary,
  weightGoalProgress,
  complianceSummary,
  nutritionAverages,
  workoutSnapshot,
  onUpdateSettings,
}) {
  const progressItems = [
    {
      label: "Calories",
      current: dailyTotals.calories,
      target: settings.calorieTarget,
      helper: `${formatMetricValue(dailyTotals.calories)} / ${formatMetricValue(settings.calorieTarget)}`,
    },
    {
      label: "Protein",
      current: dailyTotals.protein,
      target: settings.proteinTarget,
      helper: `${formatMetricValue(dailyTotals.protein)}g / ${formatMetricValue(settings.proteinTarget)}g`,
    },
    {
      label: "Carbs",
      current: dailyTotals.carbs,
      target: settings.carbsTarget,
      helper: `${formatMetricValue(dailyTotals.carbs)}g / ${formatMetricValue(settings.carbsTarget)}g`,
    },
    {
      label: "Fat",
      current: dailyTotals.fat,
      target: settings.fatTarget,
      helper: `${formatMetricValue(dailyTotals.fat)}g / ${formatMetricValue(settings.fatTarget)}g`,
    },
  ];
  const targetsHitCount = progressItems.filter((item) => {
    if (item.target <= 0) {
      return false;
    }

    const tolerance = item.label === "Calories" ? 0.1 : 0.15;
    return Math.abs(item.current - item.target) / item.target <= tolerance;
  }).length;

  return (
    <div className="section-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>Daily snapshot</h2>
          </div>
          <p className="muted">Everything below reflects {formattedDate}.</p>
        </div>

        <div className="progress-grid" aria-label="Daily target progress">
          {progressItems.map((item) => {
            const percent = item.target > 0 ? Math.min((item.current / item.target) * 100, 100) : 0;
            const remainingValue = item.target - item.current;

            return (
              <article className="progress-card" key={item.label}>
                <div className="progress-card__top">
                  <strong>{item.label}</strong>
                  <span>{Math.round(percent)}%</span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${percent}%` }} />
                </div>
                <p className="muted">
                  {item.helper} • {formatRemaining(remainingValue, item.label === "Calories" ? "cal" : "g")}
                </p>
              </article>
            );
          })}
        </div>

        <div className="summary-grid dashboard-summary-grid">
          <div className="summary-panel">
            <span>Targets Hit</span>
            <strong>{targetsHitCount}/4</strong>
            <p className="muted">
              {targetsHitCount === 4
                ? "All daily targets are within range."
                : `${4 - targetsHitCount} target${4 - targetsHitCount === 1 ? "" : "s"} still outside range.`}
            </p>
          </div>
          <div className="summary-panel">
            <span>Compliance score</span>
            <strong>{complianceSummary.score}%</strong>
            <p className="muted">
              {complianceSummary.label}. Based on how close calories and macros are to target.
            </p>
          </div>
        </div>

        <div className="summary-grid dashboard-summary-grid">
          <div className="summary-panel">
            <span>7-day average calories</span>
            <strong>{formatMetricValue(nutritionAverages.weeklyAverage.calories)}</strong>
            <p className="muted">Daily average across the last 7 selected days</p>
          </div>
          <div className="summary-panel">
            <span>7-day average protein</span>
            <strong>{formatMetricValue(nutritionAverages.weeklyAverage.protein)}g</strong>
            <p className="muted">
              Carbs {formatMetricValue(nutritionAverages.weeklyAverage.carbs)}g • Fat {formatMetricValue(nutritionAverages.weeklyAverage.fat)}g
            </p>
          </div>
          <div className="summary-panel">
            <span>Calories vs yesterday</span>
            <strong>{formatDelta(dailyTotals.calories - nutritionAverages.yesterdayTotals.calories, "cal")}</strong>
            <p className="muted">
              Protein {formatDelta(dailyTotals.protein - nutritionAverages.yesterdayTotals.protein, "g")}
            </p>
          </div>
          <div className="summary-panel">
            <span>Carbs and fat vs yesterday</span>
            <strong>{formatDelta(dailyTotals.carbs - nutritionAverages.yesterdayTotals.carbs, "g")}</strong>
            <p className="muted">
              Fat {formatDelta(dailyTotals.fat - nutritionAverages.yesterdayTotals.fat, "g")}
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Body weight</p>
            <h2>Current status</h2>
          </div>
          <p className="muted">
            Goal: {settings.weightGoal || "Not set"} {settings.weightUnit}
          </p>
        </div>

        <div className="summary-grid">
          <div className="summary-panel">
            <span>Latest weight</span>
            <strong>
              {latestWeight ? `${latestWeight.weight} ${settings.weightUnit}` : "--"}
            </strong>
          </div>
          <div className="summary-panel">
            <span>Trend weight</span>
            <strong>
              {weightTrendSummary.latestTrendWeight !== null
                ? `${weightTrendSummary.latestTrendWeight} ${settings.weightUnit}`
                : "--"}
            </strong>
          </div>
          <div className="summary-panel">
            <span>Recent trend</span>
            <strong>
              {weightTrendSummary.weeklyChange !== null
                ? `${weightTrendSummary.weeklyChange > 0 ? "+" : ""}${weightTrendSummary.weeklyChange} ${settings.weightUnit}/wk`
                : "Need more data"}
            </strong>
          </div>
          <div className="summary-panel">
            <span>Goal progress</span>
            <strong>
              {weightGoalProgress.progressPercent !== null
                ? `${weightGoalProgress.progressPercent}%`
                : "Set goal"}
            </strong>
            <p className="muted">
              {weightGoalProgress.remainingToGoal !== null
                ? `${Math.abs(weightGoalProgress.remainingToGoal)} ${settings.weightUnit} remaining`
                : "Add goal and weigh-ins"}
            </p>
          </div>
          <div className="summary-panel">
            <span>ETA</span>
            <strong>
              {weightGoalProgress.estimatedWeeks !== null
                ? `${weightGoalProgress.estimatedWeeks} weeks`
                : "--"}
            </strong>
            <p className="muted">Based on current smoothed weekly trend</p>
          </div>
        </div>

        <WeightTrendChart entries={weightTrendSummary.smoothedEntries.slice(-8)} />
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workout progress</p>
            <h2>Training momentum</h2>
          </div>
          <p className="muted">Pulled from workouts saved on or before {formattedDate}.</p>
        </div>

        <div className="summary-grid">
          <div className="summary-panel">
            <span>Last workout</span>
            <strong>{workoutSnapshot.lastWorkout?.workoutName || "No workouts yet"}</strong>
            <p className="muted">
              {workoutSnapshot.lastWorkout ? workoutSnapshot.lastWorkout.date : "Save a workout to start tracking."}
            </p>
          </div>
          <div className="summary-panel">
            <span>Sessions last 30 days</span>
            <strong>{workoutSnapshot.sessionsLast30}</strong>
            <p className="muted">
              {workoutSnapshot.totalSetsLast30} sets across {workoutSnapshot.uniqueExercisesLast30} exercises
            </p>
          </div>
          <div className="summary-panel">
            <span>Strongest recorded set</span>
            <strong>{workoutSnapshot.strongestSet ? `${formatMetricValue(workoutSnapshot.strongestSet.weight)} lb` : "--"}</strong>
            <p className="muted">
              {workoutSnapshot.strongestSet
                ? `${workoutSnapshot.strongestSet.exerciseName} on ${workoutSnapshot.strongestSet.date}`
                : "Log more workouts to surface your top lift."}
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2>Theme color</h2>
          </div>
          <p className="muted">Choose the accent used across charts, buttons, and highlights.</p>
        </div>

        <label>
          Accent color
          <select
            value={settings.accentColor}
            onChange={(event) => onUpdateSettings({ accentColor: event.target.value })}
          >
            <option value="blue">Blue</option>
            <option value="purple">Purple</option>
          </select>
        </label>
      </section>
    </div>
  );
}
