import { hoursBetween, formatDate } from './time';
import { getPayPeriodRange, toDateKey } from './payroll';

/** Minimal shape grouping needs - both the employee's own TimeEntry rows
 *  and the admin's AdminTimeEntryRow (which adds a `profiles` field) satisfy
 *  this structurally, so one implementation covers both call sites. */
interface Groupable {
  clock_in: string;
  clock_out: string | null;
}

export interface DayGroup<T> {
  dateKey: string;
  label: string;
  totalHours: number;
  entries: T[];
}

/** Groups entries by calendar day (the day clock_in falls on), most recent
 *  day first - assumes entries already arrive sorted newest-first, which
 *  every caller's query does, so a Map preserves that day order. */
export function groupByDay<T extends Groupable>(entries: T[]): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const entry of entries) {
    const dateKey = toDateKey(new Date(entry.clock_in));
    let group = groups.get(dateKey);
    if (!group) {
      group = { dateKey, label: formatDate(entry.clock_in), totalHours: 0, entries: [] };
      groups.set(dateKey, group);
    }
    group.entries.push(entry);
    if (entry.clock_out) group.totalHours += hoursBetween(entry.clock_in, entry.clock_out);
  }
  return [...groups.values()];
}

export interface PayPeriodGroup<T> {
  periodKey: string;
  label: string;
  totalHours: number;
  entries: T[];
}

/** Groups entries by which 2-week pay period their clock_in falls into
 *  (see getPayPeriodRange), most recent period first. Entries within a
 *  single-period date range (the common case) come back as one group. */
export function groupByPayPeriod<T extends Groupable>(entries: T[]): PayPeriodGroup<T>[] {
  const groups = new Map<string, PayPeriodGroup<T>>();
  for (const entry of entries) {
    const { start, end } = getPayPeriodRange(new Date(entry.clock_in));
    const periodKey = toDateKey(start);
    let group = groups.get(periodKey);
    if (!group) {
      group = { periodKey, label: `${formatDate(start.toISOString())} - ${formatDate(end.toISOString())}`, totalHours: 0, entries: [] };
      groups.set(periodKey, group);
    }
    group.entries.push(entry);
    if (entry.clock_out) group.totalHours += hoursBetween(entry.clock_in, entry.clock_out);
  }
  return [...groups.values()];
}
