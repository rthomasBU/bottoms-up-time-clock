/**
 * Payday math. Pay periods are 2 weeks, ending Sundays, anchored to
 * 2026-08-23 (the same anchor used for the biweekly PTO accrual - see
 * supabase/migrations/0005_pto_accrual.sql). Payday is the Friday following
 * each period end (verified: 2026-08-23 is a Sunday, +5 days = Friday
 * 2026-08-28). This is pure arithmetic, not stored anywhere.
 */
const PAY_PERIOD_END_ANCHOR = new Date('2026-08-23T00:00:00');
const PERIOD_LENGTH_DAYS = 14;
const PAYDAY_OFFSET_DAYS = 5;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** All paydays that fall within [start, end], inclusive. */
export function getPaydaysInRange(start: Date, end: Date): Date[] {
  const paydays: Date[] = [];

  // Walk backward from the anchor to find the first period end at or before
  // `start`'s relevant window, then step forward 14 days at a time.
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysFromAnchor = Math.floor((start.getTime() - PAY_PERIOD_END_ANCHOR.getTime()) / msPerDay);
  const periodsBack = Math.floor(daysFromAnchor / PERIOD_LENGTH_DAYS) - 1;
  let periodEnd = addDays(PAY_PERIOD_END_ANCHOR, periodsBack * PERIOD_LENGTH_DAYS);

  // Safety cap so a bad date range can't loop forever.
  for (let i = 0; i < 200; i++) {
    const payday = addDays(periodEnd, PAYDAY_OFFSET_DAYS);
    if (payday > end) break;
    if (payday >= start) paydays.push(payday);
    periodEnd = addDays(periodEnd, PERIOD_LENGTH_DAYS);
  }

  return paydays;
}

/** Start (00:00:00) through end (23:59:59.999) of the 2-week pay period
 *  containing `now`, using the same period-end anchor as getPaydaysInRange -
 *  periods end Sundays, anchored to 2026-08-23, so e.g. 2026-08-24 through
 *  2026-09-06 is one period. */
export function getCurrentPayPeriodRange(now: Date): { start: Date; end: Date } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysFromAnchor = Math.round((nowDateOnly.getTime() - PAY_PERIOD_END_ANCHOR.getTime()) / msPerDay);
  const periodsFromAnchor = Math.ceil(daysFromAnchor / PERIOD_LENGTH_DAYS);
  const end = addDays(PAY_PERIOD_END_ANCHOR, periodsFromAnchor * PERIOD_LENGTH_DAYS);
  const start = addDays(end, -(PERIOD_LENGTH_DAYS - 1));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** yyyy-mm-dd, for comparing against a calendar cell's date. */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
}

/** Always exactly 6 weeks (42 days) so the grid is a consistent size
 *  regardless of which weekday the month starts/ends on. Includes the
 *  leading/trailing days from the adjacent months needed to fill the grid. */
export function getMonthGrid(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const startWeekday = new Date(year, m, 1).getDay(); // 0 = Sunday
  const gridStart = new Date(year, m, 1 - startWeekday);

  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    days.push({ date, inCurrentMonth: date.getMonth() === m });
  }
  return days;
}
