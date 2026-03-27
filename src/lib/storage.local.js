const STORAGE_KEY = "fittrack.app.v1";

export function hasMeaningfulLocalData(snapshot) {
  if (!snapshot) {
    return false;
  }

  return Boolean(
    snapshot.foodEntries?.length ||
      snapshot.mealTemplates?.length ||
      snapshot.weightEntries?.length ||
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
    } catch (error) {
      console.error("Failed to save FitTrack data to localStorage.", error);
    }
  },
};
