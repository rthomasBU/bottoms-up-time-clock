import { useState } from 'react';
import { useAdminTimeEntries, type EntryFilters, type AdminTimeEntryRow } from '../../hooks/useAdminTimeEntries';
import { useAdminTravelDays } from '../../hooks/useAdminTravelDays';
import { useTeamPto } from '../../hooks/useTeamPto';
import { useEmployees } from '../../hooks/useEmployees';
import { hoursBetween, formatDate } from '../../lib/time';
import { getPayPeriodRange, toDateKey } from '../../lib/payroll';
import { toCsv, downloadCsv } from '../../lib/csv';
import { buildPayrollExportRows, downloadPayrollExportXlsx } from '../../lib/payrollExport';
import type { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface EmployeeHoursTotal {
  employeeId: string;
  fullName: string;
  totalHours: number;
}

/** One row per employee (every employee passed in, even ones with zero
 *  closed hours in range) - matches the "always list the full roster"
 *  pattern used by the GRIN export and Timesheets Browser. */
function buildEmployeeHoursTotals(employees: Profile[], closedEntries: AdminTimeEntryRow[]): EmployeeHoursTotal[] {
  const totalsByEmployee = new Map<string, number>();
  for (const e of closedEntries) {
    totalsByEmployee.set(e.employee_id, (totalsByEmployee.get(e.employee_id) ?? 0) + hoursBetween(e.clock_in, e.clock_out!));
  }
  return employees.map((emp) => ({
    employeeId: emp.id,
    fullName: emp.full_name,
    totalHours: totalsByEmployee.get(emp.id) ?? 0,
  }));
}

function defaultExportFilters(): EntryFilters {
  // Defaults to the current pay period (always whole Monday-Sunday weeks,
  // per getPayPeriodRange) rather than a rolling "last 14 days" - the GRIN
  // payroll export's overtime math is only exact when the exported range
  // covers whole weeks, and a payroll run is naturally period-based anyway.
  const { start, end } = getPayPeriodRange(new Date());
  return {
    from: toDateKey(start),
    to: toDateKey(end),
    employeeId: 'all',
  };
}

export function ExportPage() {
  const [filters, setFilters] = useState<EntryFilters>(defaultExportFilters());
  const { entries, loading, error } = useAdminTimeEntries(filters);
  const { travelDays, loading: travelDaysLoading, error: travelDaysError } = useAdminTravelDays(filters);
  const { requests: ptoRequests } = useTeamPto(filters.from, filters.to);
  const { employees } = useEmployees();
  const [payrollExporting, setPayrollExporting] = useState(false);

  const closedEntries = entries.filter((e) => e.clock_out);
  const totalHours = closedEntries.reduce((sum, e) => sum + hoursBetween(e.clock_in, e.clock_out!), 0);
  const openCount = entries.length - closedEntries.length;
  const visibleEmployees = filters.employeeId === 'all' ? employees : employees.filter((emp) => emp.id === filters.employeeId);
  const missingPayrollId = visibleEmployees.filter((emp) => !emp.payroll_id).length;
  const employeeHoursTotals = buildEmployeeHoursTotals(visibleEmployees, closedEntries);

  async function handleExportPayroll() {
    setPayrollExporting(true);
    try {
      const rows = buildPayrollExportRows(visibleEmployees, entries, ptoRequests, travelDays);
      const filename = `ExcelTimeClock_GRIN_${toDateKey(new Date()).replace(/-/g, '')}.xlsx`;
      await downloadPayrollExportXlsx(rows, filename);
    } finally {
      setPayrollExporting(false);
    }
  }

  function handleExportCsv() {
    const rows = employeeHoursTotals.map((t) => ({
      employee: t.fullName,
      hours: t.totalHours.toFixed(2),
    }));
    const csv = toCsv(rows);
    downloadCsv(`timesheet_${filters.from}_to_${filters.to}.csv`, csv);
  }

  function handleExportTravelDaysCsv() {
    const rows = travelDays.map((t) => ({
      employee: t.profiles?.full_name ?? 'Unknown',
      date: formatDate(t.travel_date),
      notes: t.notes ?? '',
      logged_by: t.source === 'self' ? 'Employee' : 'Admin',
    }));
    const csv = toCsv(rows);
    downloadCsv(`travel_days_${filters.from}_to_${filters.to}.csv`, csv);
  }

  return (
    <div>
      <h1>
        Export <span>Timesheets</span>
      </h1>
      <p className="sub">Download hours for payroll, or print a paper copy.</p>

      <div className="filter-row no-print">
        <div className="fcol">
          <label htmlFor="from">From</label>
          <input id="from" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div className="fcol">
          <label htmlFor="to">To</label>
          <input id="to" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div className="fcol">
          <label htmlFor="employee">Employee</label>
          <select id="employee" value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}>
            <option value="all">All</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-head">
        <span className="num">1</span>
        <h2>Payroll Import (GRIN)</h2>
      </div>
      <p className="form-hint">
        One row per employee for the selected range, matching GRIN's own ExcelTimeClock import format (EmployeeID,
        hours split into regular/overtime, PTO, per diem). Bonus, Tech Support, and Holiday units aren't tracked here
        and always export blank.
        {missingPayrollId > 0 &&
          ` ${missingPayrollId} employee${missingPayrollId === 1 ? '' : 's'} missing a Payroll ID (set it in Supabase Table Editor -> profiles -> payroll_id) - their EmployeeID cell will be blank.`}
      </p>
      <div className="export-actions no-print">
        <button type="button" className="btn-build" onClick={() => void handleExportPayroll()} disabled={payrollExporting}>
          {payrollExporting ? 'Exporting...' : 'Export Payroll (GRIN Format)'}
        </button>
      </div>

      <div className="section-head">
        <span className="num">2</span>
        <h2>Hours</h2>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Loading...</p>}

      <p className="form-hint">
        {closedEntries.length} entries, {totalHours.toFixed(2)} hours total
        {openCount > 0 && `, ${openCount} still clocked in (excluded)`}
      </p>

      <div className="export-actions no-print">
        <button type="button" onClick={handleExportCsv} disabled={closedEntries.length === 0}>
          Export CSV
        </button>
        <button type="button" onClick={() => window.print()} disabled={closedEntries.length === 0}>
          Export PDF (Print)
        </button>
      </div>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {employeeHoursTotals.map((t) => (
              <tr key={t.employeeId} className="row">
                <td>{t.fullName}</td>
                <td className="num">{t.totalHours.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head">
        <span className="num">3</span>
        <h2>Travel Days (Per Diem)</h2>
      </div>

      {travelDaysError && <p className="form-error">{travelDaysError}</p>}
      {travelDaysLoading && <p>Loading...</p>}
      {!travelDaysLoading && travelDays.length === 0 && <p className="form-hint">No travel days logged in this range.</p>}

      {travelDays.length > 0 && (
        <>
          <div className="export-actions no-print">
            <button type="button" onClick={handleExportTravelDaysCsv}>
              Export Travel Days CSV
            </button>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {travelDays.map((t) => (
                  <tr key={t.id} className="row">
                    <td>{t.profiles?.full_name ?? 'Unknown'}</td>
                    <td>{formatDate(t.travel_date)}</td>
                    <td>{t.notes}</td>
                    <td>
                      <span className={`tag ${t.source === 'self' ? 'muted' : 'ok'}`}>
                        {t.source === 'self' ? 'Employee' : 'Admin'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
