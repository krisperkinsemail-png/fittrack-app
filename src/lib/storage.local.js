const STORAGE_KEY = "fittrack.app.v1";
const THEME_KEY = "fittrack.theme-accent.v1";
const CLOUD_CACHE_KEY_PREFIX = "fittrack.cloud-cache.v1.";

function getCloudCacheKey(userId) {
  return `${CLOUD_CACHE_KEY_PREFIX}${userId}`;
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error("Failed to read FitTrack local data.", error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Failed to save FitTrack local data.", error);
  }
}

export function loadCloudCache(userId) {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  const cached = readJson(getCloudCacheKey(userId), null);
  if (!cached?.snapshot || typeof cached.snapshot !== "object") {
    return null;
  }

  return {
    snapshot: cached.snapshot,
    pendingCollections: Array.isArray(cached.pendingCollections) ? cached.pendingCollections : [],
    updatedAt: cached.updatedAt || null,
  };
}

export function saveCloudCache(userId, snapshot, pendingCollections = []) {
  if (typeof window === "undefined" || !userId || !snapshot) {
    return;
  }

  writeJson(getCloudCacheKey(userId), {
    snapshot,
    pendingCollections: [...new Set(pendingCollections)],
    updatedAt: new Date().toISOString(),
  });
}

export function updateCloudCache(userId, updates, { markPending, clearPending } = {}) {
  const current = loadCloudCache(userId) || {
    snapshot: {},
    pendingCollections: [],
  };
  const pendingCollections = new Set(current.pendingCollections);

  if (markPending) {
    pendingCollections.add(markPending);
  }
  if (clearPending) {
    pendingCollections.delete(clearPending);
  }

  saveCloudCache(
    userId,
    { ...current.snapshot, ...updates },
    [...pendingCollections]
  );
}

export function hasMeaningfulLocalData(snapshot) {
  if (!snapshot) {
    return false;
  }

  return Boolean(
    snapshot.foodEntries?.length ||
      snapshot.mealTemplates?.length ||
      snapshot.weightEntries?.length ||
      snapshot.waterEntries?.length ||
      snapshot.workoutEntries?.length ||
      snapshot.customWorkoutSystems?.length ||
      snapshot.settings?.weightGoal
  );
}

export const localStorageAdapter = {
  async load() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : {};
    } catch (error) {
      console.error("Failed to load FitTrack data from localStorage.", error);
      return {};
    }
  },
  async save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (state?.settings?.accentColor) {
        window.localStorage.setItem(THEME_KEY, state.settings.accentColor);
      }
    } catch (error) {
      console.error("Failed to save FitTrack data to localStorage.", error);
    }
  },
};

export function getStoredAccentColor() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const directAccent = window.localStorage.getItem(THEME_KEY);
    if (directAccent) {
      return directAccent;
    }

    const snapshot = window.localStorage.getItem(STORAGE_KEY);
    if (!snapshot) {
      return null;
    }

    return JSON.parse(snapshot)?.settings?.accentColor || null;
  } catch (error) {
    console.error("Failed to load FitTrack accent color from localStorage.", error);
    return null;
  }
}

export function persistAccentColor(accentColor) {
  if (typeof window === "undefined" || !accentColor) {
    return;
  }

  try {
    window.localStorage.setItem(THEME_KEY, accentColor);
  } catch (error) {
    console.error("Failed to persist FitTrack accent color to localStorage.", error);
  }
}
