import { formatShortDate } from "../lib/date";

export function WeightTrendChart({ entries }) {
  if (!entries.length) {
    return (
      <div className="empty-panel">
        <p>No weight data yet.</p>
      </div>
    );
  }

  const values = entries.map((entry) => entry.trendWeight ?? entry.weight);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = entries.map((entry, index) => {
    const x = (index / Math.max(entries.length - 1, 1)) * 100;
    const y = 100 - (((entry.trendWeight ?? entry.weight) - min) / range) * 100;
    return { id: entry.id, x, y };
  });

  return (
    <div className="chart-card">
      <svg viewBox="0 0 100 100" className="trend-chart" preserveAspectRatio="none">
        <line x1="0" y1="100" x2="100" y2="100" className="trend-axis" />
        {points.length === 1 ? (
          <circle cx={50} cy={points[0].y} r="0.8" className="trend-dot" />
        ) : (
          <>
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((point) => (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r="0.55"
                className="trend-dot"
              />
            ))}
          </>
        )}
      </svg>
      <div className="chart-labels">
        {entries.map((entry) => (
          <span key={entry.id}>{formatShortDate(entry.date)}</span>
        ))}
      </div>
    </div>
  );
}
