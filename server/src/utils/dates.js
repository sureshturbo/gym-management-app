/** Today's date (YYYY-MM-DD) in the given IANA timezone. */
export function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Add calendar months, clamping to the last day of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(dateStr, months) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/** Inclusive expiry: a 1-month plan starting 2026-01-10 is valid through 2026-02-09. */
export function computeExpiry(startDate, unit, value) {
  const end = unit === 'month' ? addMonths(startDate, value) : addDays(startDate, value);
  return addDays(end, -1);
}

export function daysBetween(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000);
}

export function monthStart(dateStr) {
  return `${dateStr.slice(0, 7)}-01`;
}
