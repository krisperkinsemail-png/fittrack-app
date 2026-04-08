const STORAGE_KEY = "fittrack.app.v1";
const THEME_KEY = "fittrack.theme-accent.v1";
const WATER_CACHE_KEY = "fittrack.water-cache.v1";

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

export function loadCachedWaterEntries() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(WATER_CACHE_KEY);
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load FitTrack water cache from localStorage.", error);
    return [];
  }
}

export function saveCachedWaterEntries(entries) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!entries?.length) {
      window.localStorage.removeItem(WATER_CACHE_KEY);
      return;
    }

    window.localStorage.setItem(WATER_CACHE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to save FitTrack water cache to localStorage.", error);
  }
}

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
