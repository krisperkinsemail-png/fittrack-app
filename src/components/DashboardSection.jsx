import { WeightTrendChart } from "./WeightTrendChart";

function formatRemaining(value, unit) {
  if (value >= 0) {
    return `${value} ${unit} left`;
  }

  return `${Math.abs(value)} ${unit} over`;
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
  onUpdateSettings,
}) {
  const progressItems = [
    {
      label: "Calories",
      current: dailyTotals.calories,
      target: settings.calorieTarget,
      helper: `${dailyTotals.calories} / ${settings.calorieTarget}`,
    },
    {
      label: "Protein",
      current: dailyTotals.protein,
      target: settings.proteinTarget,
      helper: `${dailyTotals.protein}g / ${settings.proteinTarget}g`,
    },
    {
      label: "Carbs",
      current: dailyTotals.carbs,
      target: settings.carbsTarget,
      helper: `${dailyTotals.carbs}g / ${settings.carbsTarget}g`,
    },
    {
      label: "Fat",
      current: dailyTotals.fat,
      target: settings.fatTarget,
      helper: `${dailyTotals.fat}g / ${settings.fatTarget}g`,
    },
  ];

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

        <div className="summary-grid">
          <div className="summary-panel">
            <span>Compliance score</span>
            <strong>{complianceSummary.score}%</strong>
            <p className="muted">{complianceSummary.label}</p>
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
