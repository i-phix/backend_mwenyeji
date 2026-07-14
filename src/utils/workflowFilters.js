// Shared helpers for the landlord/admin "workflow" list views (applications,
// bookings, reservations) which all support the same search/day/date/status
// query params and an "upcoming first" sort. Datasets here are small enough
// per-landlord that filtering the populated, in-memory list is simpler and
// safer than hand-rolling aggregation pipelines for every collection.

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function matchesDay(date, dayFilter) {
  if (!dayFilter) return true;
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  if (dayFilter === "today") return startOfDay(d).getTime() === startOfDay(now).getTime();
  if (dayFilter === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return startOfDay(d).getTime() === startOfDay(tomorrow).getTime();
  }
  return DAY_NAMES[d.getDay()] === dayFilter;
}

function matchesDate(date, dateFilter) {
  if (!dateFilter) return true;
  if (!date) return false;
  const d = new Date(date);
  const target = new Date(dateFilter);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

function matchesSearch(item, fields, search) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return fields.some((f) => String(f || "").toLowerCase().includes(needle));
}

// Sorts by nearest-upcoming-first using the given date-ish field, falling
// back to createdAt so items with no scheduled date still land somewhere
// stable.
function sortUpcoming(list, dateField) {
  return [...list].sort((a, b) => {
    const da = a[dateField] ? new Date(a[dateField]).getTime() : new Date(a.createdAt).getTime();
    const db = b[dateField] ? new Date(b[dateField]).getTime() : new Date(b.createdAt).getTime();
    return da - db;
  });
}

module.exports = { matchesDay, matchesDate, matchesSearch, sortUpcoming };
