// Reusable SQL fragments. They all expect a :today named parameter (gym-local YYYY-MM-DD).

/** Derived membership status for alias `a`. */
export const MS_STATUS = (a = 'ms') => `CASE
  WHEN ${a}.is_cancelled = 1 THEN 'cancelled'
  WHEN ${a}.start_date > :today THEN 'pending'
  WHEN ${a}.expiry_date < :today THEN 'expired'
  ELSE 'active' END`;

/** Total paid towards membership alias `a`. */
export const MS_PAID = (a = 'ms') =>
  `(SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.membership_id = ${a}.id)`;

/** Latest expiry among started, non-cancelled memberships of member alias `m`. */
export const MEMBER_CURRENT_EXPIRY = (m = 'm') =>
  `(SELECT MAX(x.expiry_date) FROM memberships x
     WHERE x.member_id = ${m}.id AND x.is_cancelled = 0 AND x.start_date <= :today)`;

/** 1 if member alias `m` has a non-cancelled membership starting in the future. */
export const MEMBER_HAS_UPCOMING = (m = 'm') =>
  `EXISTS (SELECT 1 FROM memberships x
     WHERE x.member_id = ${m}.id AND x.is_cancelled = 0 AND x.start_date > :today)`;

/** Condition: member alias `m` has a membership covering today. */
export const MEMBER_IS_ACTIVE = (m = 'm') =>
  `EXISTS (SELECT 1 FROM memberships x
     WHERE x.member_id = ${m}.id AND x.is_cancelled = 0
       AND x.start_date <= :today AND x.expiry_date >= :today)`;

/** Last check-in date of member alias `m`. */
export const MEMBER_LAST_VISIT = (m = 'm') =>
  `(SELECT MAX(a.check_in_date) FROM attendance a WHERE a.member_id = ${m}.id)`;

/** Member status shown in lists: inactive | active | pending | expired | no_plan. */
export function memberStatus(row, today) {
  if (!row.is_active) return 'inactive';
  if (row.current_expiry && row.current_expiry >= today) return 'active';
  if (row.has_upcoming) return 'pending';
  return row.current_expiry ? 'expired' : 'no_plan';
}
