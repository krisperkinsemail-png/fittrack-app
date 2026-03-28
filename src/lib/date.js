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
  const date = new Date(`${dateString}T12:00:00`);
  const parts = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const day = date.getDate();

  return parts
    .map((part) => (part.type === "day" ? `${day}${getOrdinalSuffix(day)}` : part.value))
    .join("");
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

function getOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
