// U.S. federal holiday dates for a given year - computed, not hardcoded,
// since most of them are "Nth weekday of month" rules rather than fixed
// calendar dates (e.g. Thanksgiving is always the 4th Thursday of
// November, not November 26th). Uses the actual calendar date, not the
// federal government's "observed" shift when a fixed-date holiday falls on
// a weekend (e.g. July 4th on a Saturday is federally observed the
// preceding Friday) - a private company's holiday list is more often
// expected to show the real date.
import { toDateKey } from './payroll';

export interface FederalHoliday {
  name: string;
  date: string; // yyyy-mm-dd
}

type HolidaySpec =
  | { name: string; kind: 'fixed'; month: number; day: number }
  | { name: string; kind: 'nth-weekday'; month: number; weekday: number; n: number }
  | { name: string; kind: 'last-weekday'; month: number; weekday: number };

// month: 0-11 (Date convention). weekday: 0=Sunday..6=Saturday.
const FEDERAL_HOLIDAY_SPECS: HolidaySpec[] = [
  { name: "New Year's Day", kind: 'fixed', month: 0, day: 1 },
  { name: 'Martin Luther King Jr. Day', kind: 'nth-weekday', month: 0, weekday: 1, n: 3 },
  { name: "Washington's Birthday", kind: 'nth-weekday', month: 1, weekday: 1, n: 3 },
  { name: 'Memorial Day', kind: 'last-weekday', month: 4, weekday: 1 },
  { name: 'Juneteenth National Independence Day', kind: 'fixed', month: 5, day: 19 },
  { name: 'Independence Day', kind: 'fixed', month: 6, day: 4 },
  { name: 'Labor Day', kind: 'nth-weekday', month: 8, weekday: 1, n: 1 },
  { name: 'Columbus Day', kind: 'nth-weekday', month: 9, weekday: 1, n: 2 },
  { name: 'Veterans Day', kind: 'fixed', month: 10, day: 11 },
  { name: 'Thanksgiving Day', kind: 'nth-weekday', month: 10, weekday: 4, n: 4 },
  { name: 'Christmas Day', kind: 'fixed', month: 11, day: 25 },
];

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

export function getFederalHolidays(year: number): FederalHoliday[] {
  return FEDERAL_HOLIDAY_SPECS.map((spec) => {
    const date =
      spec.kind === 'fixed'
        ? new Date(year, spec.month, spec.day)
        : spec.kind === 'nth-weekday'
          ? nthWeekdayOfMonth(year, spec.month, spec.weekday, spec.n)
          : lastWeekdayOfMonth(year, spec.month, spec.weekday);
    return { name: spec.name, date: toDateKey(date) };
  });
}
