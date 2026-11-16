const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** ₹8,300 for whole rupees, ₹8,300.50 only when there are paise. */
export const money = (n) => {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? inrWhole.format(v) : inr.format(v);
};

/** 'YYYY-MM-DD' -> '16 Nov 2026' */
export function date(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** UTC 'YYYY-MM-DD HH:mm:ss' from the API -> local time like '6:42 am' */
export function time(utc) {
  if (!utc) return '—';
  return new Date(`${utc.replace(' ', 'T')}Z`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function dateTime(utc) {
  if (!utc) return '—';
  return new Date(`${utc.replace(' ', 'T')}Z`).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Local today as YYYY-MM-DD (for form defaults). */
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const STATUS = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Upcoming', tone: 'info' },
  expired: { label: 'Expired', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  no_plan: { label: 'No plan', tone: 'warning' },
  inactive: { label: 'Inactive', tone: 'muted' },
};

export const REASONS = {
  expiring: 'Membership expiring',
  payment_pending: 'Payment pending',
  absent: 'Absent',
  renewal: 'Renewal',
  general: 'General',
};

export const planDuration = (p) =>
  p.duration_unit === 'month'
    ? { 1: 'Monthly', 3: 'Quarterly', 6: 'Half-yearly', 12: 'Yearly' }[p.duration_value] ??
      `${p.duration_value} months`
    : `${p.duration_value} days`;
