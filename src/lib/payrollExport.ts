// Builds the payroll import file for GRIN, matching the exact column
// layout of the ExcelTimeClock_GRIN_*.xlsx template GRIN itself exports:
// EmployeeID, FirstName, LastName, Dept, Locn, Job, Shift, then one
// Pay/<category>/Units column per pay category. `xlsx` (SheetJS) is
// dynamic-imported only when a payroll export is actually requested, so
// its ~1MB isn't in every employee's clock-in bundle for a feature only
// admins use.
//
// What we don't track and always leave blank: Job, Pay/Bonus/Units,
// Pay/Tech Support/Units, Pay/Holiday/Units - nothing in this app produces
// that data. Pay/PTO/Units combines both 'pto' and 'sick' request types,
// since the template has no separate sick column. Overtime is computed per
// Monday-Sunday workweek (hours over 40 in a week -> Overtime, the rest ->
// Hourly) only from entries actually included in the exported date range -
// exporting a range that splits a workweek in two will misattribute hours
// worked outside the range, so this is only exact when the range covers
// whole weeks (the default filter - one full pay period - always does).

import { hoursBetween, getCurrentWeekRange } from './time';
import { toDateKey } from './payroll';
import type { Database } from './database.types';
import type { AdminTimeEntryRow } from '../hooks/useAdminTimeEntries';
import type { AdminTravelDayRow } from '../hooks/useAdminTravelDays';
import type { TeamPtoRow } from '../hooks/useTeamPto';

type Profile = Database['public']['Tables']['profiles']['Row'];

export const PAYROLL_EXPORT_HEADERS = [
  'EmployeeID',
  'FirstName',
  'LastName',
  'Dept',
  'Locn',
  'Job',
  'Shift',
  'Pay/Hourly/Units',
  'Pay/Overtime/Units',
  'Pay/Salary/Units',
  'Pay/Bonus/Units',
  'Pay/Tech Support/Units',
  'Pay/PTO/Units',
  'Pay/Holiday/Units',
  'Pay/Per Diem/Units',
] as const;

export type PayrollExportRow = Record<(typeof PAYROLL_EXPORT_HEADERS)[number], string | number>;

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** Blank (matching the template's own convention for "nothing to report")
 *  rather than "0.00" when there's genuinely nothing in that category. */
function numOrBlank(n: number): string {
  return n > 0 ? n.toFixed(2) : '';
}

/** Regular (up to 40) vs overtime (the rest) hours, split per Monday-Sunday
 *  workweek across every closed entry passed in. */
function splitHourlyOvertime(entries: { clock_in: string; clock_out: string | null }[]): {
  regular: number;
  overtime: number;
} {
  const hoursByWeek = new Map<string, number>();
  for (const e of entries) {
    if (!e.clock_out) continue;
    const { start } = getCurrentWeekRange(new Date(e.clock_in));
    const weekKey = toDateKey(start);
    hoursByWeek.set(weekKey, (hoursByWeek.get(weekKey) ?? 0) + hoursBetween(e.clock_in, e.clock_out));
  }
  let regular = 0;
  let overtime = 0;
  for (const weekTotal of hoursByWeek.values()) {
    if (weekTotal > 40) {
      regular += 40;
      overtime += weekTotal - 40;
    } else {
      regular += weekTotal;
    }
  }
  return { regular, overtime };
}

/** One row per employee (every employee passed in, regardless of whether
 *  they have any hours/PTO/travel in range - matches the GRIN template
 *  always listing the full roster). */
export function buildPayrollExportRows(
  employees: Profile[],
  timeEntries: AdminTimeEntryRow[],
  ptoRequests: TeamPtoRow[],
  travelDays: AdminTravelDayRow[],
): PayrollExportRow[] {
  const entriesByEmployee = new Map<string, AdminTimeEntryRow[]>();
  for (const e of timeEntries) {
    const list = entriesByEmployee.get(e.employee_id);
    if (list) list.push(e);
    else entriesByEmployee.set(e.employee_id, [e]);
  }

  const ptoHoursByEmployee = new Map<string, number>();
  for (const r of ptoRequests) {
    ptoHoursByEmployee.set(r.employee_id, (ptoHoursByEmployee.get(r.employee_id) ?? 0) + r.hours_requested);
  }

  const travelCountByEmployee = new Map<string, number>();
  for (const t of travelDays) {
    travelCountByEmployee.set(t.employee_id, (travelCountByEmployee.get(t.employee_id) ?? 0) + 1);
  }

  return employees.map((emp): PayrollExportRow => {
    const { firstName, lastName } = splitName(emp.full_name);
    const isHourly = emp.pay_type === 'hourly';
    const { regular, overtime } = isHourly ? splitHourlyOvertime(entriesByEmployee.get(emp.id) ?? []) : { regular: 0, overtime: 0 };
    const ptoHours = ptoHoursByEmployee.get(emp.id) ?? 0;
    const travelCount = travelCountByEmployee.get(emp.id) ?? 0;

    return {
      EmployeeID: emp.payroll_id ?? '',
      FirstName: firstName,
      LastName: lastName,
      Dept: isHourly ? 'Hourly' : 'Salary',
      Locn: 'Default Location',
      Job: '',
      Shift: 1,
      'Pay/Hourly/Units': isHourly ? numOrBlank(regular) : '',
      'Pay/Overtime/Units': isHourly ? numOrBlank(overtime) : '',
      'Pay/Salary/Units': isHourly ? '' : '1',
      'Pay/Bonus/Units': '',
      'Pay/Tech Support/Units': '',
      'Pay/PTO/Units': numOrBlank(ptoHours),
      'Pay/Holiday/Units': '',
      'Pay/Per Diem/Units': travelCount > 0 ? String(travelCount) : '',
    };
  });
}

/** Writes and downloads the .xlsx - dynamic import keeps SheetJS out of
 *  the main bundle for everyone who isn't an admin exporting payroll. */
export async function downloadPayrollExportXlsx(rows: PayrollExportRow[], filename: string) {
  const XLSX = await import('xlsx');
  const aoa = [
    PAYROLL_EXPORT_HEADERS as unknown as string[],
    ...rows.map((row) => PAYROLL_EXPORT_HEADERS.map((h) => row[h])),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  const sheetName = filename.replace(/\.xlsx$/i, '').slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}
