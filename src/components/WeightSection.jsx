import { formatLongDate } from "../lib/date";
import { WeightTrendChart } from "./WeightTrendChart";

export function WeightSection({
  selectedDate,
  currentEntry,
  entries,
  settings,
  weightTrendSummary,
  weightGoalProgress,
  onSaveEntry,
  onDeleteEntry,
}) {
  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    onSaveEntry({
      date: selectedDate,
      weight: Number(formData.get("weight")),
      notes: String(formData.get("notes") || "").trim(),
    });

    event.currentTarget.reset();
  }

  return (
    <div className="section-stack">
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Weight tracking</p>
            <h2>Log body weight</h2>
          </div>
          <p className="muted">
            {currentEntry
              ? `Current entry for ${selectedDate}: ${currentEntry.weight} ${settings.weightUnit}`
              : `No weight entry for ${selectedDate}`}
          </p>
        </div>

        <form className="inline-form" onSubmit={handleSubmit}>
          <label>
            Weight ({settings.weightUnit})
            <input name="weight" type="number" inputMode="decimal" min="0" step="0.1" required />
          </label>
          <label className="inline-form__notes">
            Notes
            <input
              name="notes"
              type="text"
              maxLength="120"
              placeholder="Fasted, after long run, low sleep..."
              defaultValue={currentEntry?.notes || ""}
            />
          </label>
          <button type="submit" className="primary-button">
            Save weight
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Goal progress</p>
            <h2>Weight target status</h2>
          </div>
          <p className="muted">Uses your smoothed trend rather than daily fluctuations.</p>
        </div>

        <div className="summary-grid">
          <div className="summary-panel">
            <span>Trend weight</span>
            <strong>
              {weightGoalProgress.trendWeight !== null
                ? `${weightGoalProgress.trendWeight} ${settings.weightUnit}`
                : "--"}
            </strong>
          </div>
          <div className="summary-panel">
            <span>Remaining</span>
            <strong>
              {weightGoalProgress.remainingToGoal !== null
                ? `${Math.abs(weightGoalProgress.remainingToGoal)} ${settings.weightUnit}`
                : "--"}
            </strong>
          </div>
          <div className="summary-panel">
            <span>Progress</span>
            <strong>
              {weightGoalProgress.progressPercent !== null
                ? `${weightGoalProgress.progressPercent}%`
                : "--"}
            </strong>
          </div>
          <div className="summary-panel">
            <span>Estimated timeline</span>
            <strong>
              {weightGoalProgress.estimatedWeeks !== null
                ? `${weightGoalProgress.estimatedWeeks} weeks`
                : "--"}
            </strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Trend</p>
            <h2>Recent weight history</h2>
          </div>
          <p className="muted">
            Smoothed trend:{" "}
            {weightTrendSummary.latestTrendWeight !== null
              ? `${weightTrendSummary.latestTrendWeight} ${settings.weightUnit}`
              : "Need more data"}
            {" • "}
            Weekly change:{" "}
            {weightTrendSummary.weeklyChange !== null
              ? `${weightTrendSummary.weeklyChange > 0 ? "+" : ""}${weightTrendSummary.weeklyChange} ${settings.weightUnit}/wk`
              : "Need more data"}
          </p>
        </div>

        <WeightTrendChart entries={weightTrendSummary.smoothedEntries.slice(-8)} />

        {entries.length ? (
          <div className="list-stack">
            {entries.map((entry) => (
              <article className="log-card" key={entry.id}>
                <div className="log-card__top">
                  <div className="weight-history-header">
                    <h3>{formatLongDate(entry.date)}</h3>
                    {entry.notes ? <p className="muted weight-history-note">{entry.notes}</p> : null}
                  </div>
                </div>
                <strong className="weight-history-value">
                  {entry.weight} {settings.weightUnit}
                </strong>
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
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <p>No weight entries yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
