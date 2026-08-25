import { useState } from 'react';
import { useAdminTimeEntries, type EntryFilters } from '../../hooks/useAdminTimeEntries';
import { useAdminTravelDays } from '../../hooks/useAdminTravelDays';
import { useTeamPto } from '../../hooks/useTeamPto';
import { useEmployees } from '../../hooks/useEmployees';
import { getPayPeriodRange, toDateKey } from '../../lib/payroll';
import { buildPayrollExportRows, downloadPayrollExportXlsx, PAYROLL_EXPORT_HEADERS } from '../../lib/payrollExport';

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

  const visibleEmployees = filters.employeeId === 'all' ? employees : employees.filter((emp) => emp.id === filters.employeeId);
  const missingPayrollId = visibleEmployees.filter((emp) => !emp.payroll_id).length;
  // Same row-building function the actual .xlsx export uses, so the preview
  // table on screen is exactly what downloading produces - not a separate
  // approximation that could drift out of sync with it.
  const previewRows = buildPayrollExportRows(visibleEmployees, entries, ptoRequests, travelDays);

  async function handleExportPayroll() {
    setPayrollExporting(true);
    try {
      const filename = `ExcelTimeClock_GRIN_${toDateKey(new Date()).replace(/-/g, '')}.xlsx`;
      await downloadPayrollExportXlsx(previewRows, filename);
    } finally {
      setPayrollExporting(false);
    }
  }

  return (
    <div>
      <h1>
        Export <span>Timesheets</span>
      </h1>
      <p className="sub">Download the payroll import file for GRIN.</p>

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

      {error && <p className="form-error">{error}</p>}
      {travelDaysError && <p className="form-error">{travelDaysError}</p>}
      {(loading || travelDaysLoading) && <p>Loading...</p>}

      <p className="form-hint">Preview - exactly what the download above will contain.</p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {PAYROLL_EXPORT_HEADERS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="row">
                {PAYROLL_EXPORT_HEADERS.map((h) => (
                  <td key={h}>{row[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
