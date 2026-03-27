export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function isSameDate(left, right) {
  return left === right;
}

export function sortByDateDescending(a, b) {
  return new Date(b.date) - new Date(a.date);
}

export function formatLongDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
}

export function formatShortDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
}

export function createId() {
  return crypto.randomUUID();
}

export function getLatestWeightEntry(entries) {
  if (!entries.length) {
    return null;
  }

  return [...entries].sort(sortByDateDescending)[0];
}
