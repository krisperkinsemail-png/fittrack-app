const STORAGE_KEY = "fittrack.food-library-usage.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadFoodLibraryUsage() {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordFoodLibraryUsage(itemId) {
  if (!canUseStorage() || !itemId) {
    return {};
  }

  const current = loadFoodLibraryUsage();
  const next = {
    ...current,
    [itemId]: (current[itemId] || 0) + 1,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return current;
  }

  return next;
}
