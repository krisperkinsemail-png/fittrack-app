function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’`"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeSearchValue(value).split(/\s+/).filter(Boolean);
}

function levenshteinDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const temp = previous[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
      diagonal = temp;
    }
  }

  return previous[right.length];
}

function similarityScore(left, right) {
  const longest = Math.max(left.length, right.length);
  if (!longest) {
    return 1;
  }

  return 1 - levenshteinDistance(left, right) / longest;
}

export function getSearchMeta(query, values, threshold = 0.72) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return { tier: 3, score: 1 };
  }

  let tier = 0;
  let score = 0;

  for (const rawValue of values.filter(Boolean)) {
    const normalizedValue = normalizeSearchValue(rawValue);
    if (!normalizedValue) {
      continue;
    }

    const tokens = tokenize(normalizedValue);
    if (tokens.some((token) => token.startsWith(normalizedQuery))) {
      tier = Math.max(tier, 3);
    } else if (normalizedValue.includes(normalizedQuery)) {
      tier = Math.max(tier, 2);
    }
  }

  score = computeSearchScore(query, values);
  if (tier === 0 && score >= threshold) {
    tier = 1;
  }

  return { tier, score };
}

export function computeSearchScore(query, values) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return 1;
  }

  const queryTokens = tokenize(normalizedQuery);
  let bestScore = 0;

  for (const rawValue of values.filter(Boolean)) {
    const normalizedValue = normalizeSearchValue(rawValue);
    if (!normalizedValue) {
      continue;
    }

    if (normalizedValue.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 1);
      continue;
    }

    const valueTokens = tokenize(normalizedValue);
    let tokenScore = 0;

    for (const queryToken of queryTokens) {
      let bestToken = 0;
      for (const valueToken of valueTokens) {
        if (valueToken.includes(queryToken) || queryToken.includes(valueToken)) {
          bestToken = Math.max(bestToken, 0.92);
          continue;
        }
        bestToken = Math.max(bestToken, similarityScore(queryToken, valueToken));
      }
      tokenScore += bestToken;
    }

    if (queryTokens.length) {
      bestScore = Math.max(bestScore, tokenScore / queryTokens.length);
    }
  }

  return bestScore;
}

export function isFuzzyMatch(query, values, threshold = 0.72) {
  return computeSearchScore(query, values) >= threshold;
}

export function normalizeSearchQuery(value) {
  return normalizeSearchValue(value);
}
