/** Duration/timezone helpers. Durations are always computed on the fly from
 * clock_in/clock_out, never stored, so edits never cause drift. */

/** Hours between two ISO timestamps, rounded to 2 decimal places. */
export function hoursBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.round((ms / 1000 / 60 / 60) * 100) / 100;
}

/** Live elapsed-time display (e.g. "1h 24m") for an open entry. */
export function elapsedSince(startIso: string, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - new Date(startIso).getTime());
  const totalMinutes = Math.floor(ms / 1000 / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** Format an ISO timestamp for display in the user's local timezone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' });
}

/**
 * Formats either a full ISO timestamp or a plain `date` column value
 * (YYYY-MM-DD, no time/timezone). Plain date strings are forced to parse as
 * local midnight rather than UTC midnight - otherwise `new Date("2026-09-01")`
 * is UTC midnight, which in any timezone behind UTC displays as the previous
 * day once converted back to local time for display.
 */
export function formatDate(value: string): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** ISO timestamp -> value for an <input type="datetime-local"> (local time, no timezone). */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO timestamp string. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

/**
 * Rolling N-day-ago cutoff as a Date, matching the RLS window
 * (`clock_in >= now() - interval 'N days'`) so client-side validation
 * agrees with what the server will actually accept.
 */
export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Monday 00:00:00 through Sunday 23:59:59.999 of the week containing `now`,
 *  matching the Monday-start pay period convention used elsewhere
 *  (see src/lib/payroll.ts). */
export function getCurrentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const day = now.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return { start, end };
}
