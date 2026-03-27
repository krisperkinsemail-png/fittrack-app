import { sortByDateDescending } from "./date";

function toAscendingEntries(entries) {
  return [...entries]
    .sort(sortByDateDescending)
    .reverse()
    .map((entry) => ({
      ...entry,
      timestamp: new Date(`${entry.date}T12:00:00`).getTime(),
    }));
}

export function calculateSmoothedTrend(entries, alpha = 0.35) {
  const series = toAscendingEntries(entries);

  if (!series.length) {
    return [];
  }

  let smoothedWeight = series[0].weight;

  return series.map((entry, index) => {
    if (index === 0) {
      smoothedWeight = entry.weight;
    } else {
      smoothedWeight = alpha * entry.weight + (1 - alpha) * smoothedWeight;
    }

    return {
      ...entry,
      trendWeight: Number(smoothedWeight.toFixed(1)),
    };
  });
}

export function getWeightTrendSummary(entries) {
  const smoothedEntries = calculateSmoothedTrend(entries);

  if (!smoothedEntries.length) {
    return {
      smoothedEntries: [],
      latestTrendWeight: null,
      weeklyChange: null,
      weeklyDirection: "steady",
    };
  }

  const latest = smoothedEntries[smoothedEntries.length - 1];
  const previous = smoothedEntries[0];
  const daySpan = Math.max((latest.timestamp - previous.timestamp) / 86400000, 1);
  const trendDelta = latest.trendWeight - previous.trendWeight;
  const weeklyChange = Number(((trendDelta / daySpan) * 7).toFixed(2));

  return {
    smoothedEntries,
    latestTrendWeight: latest.trendWeight,
    weeklyChange,
    weeklyDirection:
      weeklyChange < -0.01 ? "down" : weeklyChange > 0.01 ? "up" : "steady",
  };
}

export function getWeightGoalProgress(entries, weightGoal) {
  const numericGoal = Number(weightGoal);

  if (!entries.length || !Number.isFinite(numericGoal) || numericGoal <= 0) {
    return {
      startWeight: null,
      trendWeight: null,
      remainingToGoal: null,
      progressPercent: null,
      estimatedWeeks: null,
    };
  }

  const smoothedEntries = calculateSmoothedTrend(entries);
  const startWeight = smoothedEntries[0]?.trendWeight ?? null;
  const trendWeight = smoothedEntries[smoothedEntries.length - 1]?.trendWeight ?? null;
  const totalDistance = Math.abs(startWeight - numericGoal);
  const coveredDistance = Math.abs(startWeight - trendWeight);
  const remainingToGoal = Number((trendWeight - numericGoal).toFixed(1));
  const progressPercent =
    totalDistance > 0
      ? Math.max(0, Math.min(100, Math.round((coveredDistance / totalDistance) * 100)))
      : 100;

  const trendSummary = getWeightTrendSummary(entries);
  const weeklyRate = trendSummary.weeklyChange;
  let estimatedWeeks = null;

  if (weeklyRate !== null) {
    const movingTowardGoal =
      (numericGoal < trendWeight && weeklyRate < 0) ||
      (numericGoal > trendWeight && weeklyRate > 0);

    if (movingTowardGoal && Math.abs(weeklyRate) > 0.01) {
      estimatedWeeks = Number((Math.abs(remainingToGoal) / Math.abs(weeklyRate)).toFixed(1));
    }
  }

  return {
    startWeight,
    trendWeight,
    remainingToGoal,
    progressPercent,
    estimatedWeeks,
  };
}
