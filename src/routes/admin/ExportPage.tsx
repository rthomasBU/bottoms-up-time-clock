import { useMemo, useState } from 'react';
import { useAdminTimeEntries, type EntryFilters } from '../../hooks/useAdminTimeEntries';
import { useAdminTravelDays } from '../../hooks/useAdminTravelDays';
import { useTeamPto } from '../../hooks/useTeamPto';
import { useEmployees } from '../../hooks/useEmployees';
import { getPayPeriodRangeByOffset, toDateKey } from '../../lib/payroll';
import { buildPayrollExportRows, downloadPayrollExportXlsx, PAYROLL_EXPORT_HEADERS } from '../../lib/payrollExport';

// Next period, current, and the past 11 (about 6 months back) - newest
// first. Payroll is always run for a whole period (the GRIN export's
// overtime math depends on that), so picking one from a list rather than
// two free-form dates makes it impossible to select a partial period.
const PERIOD_OFFSETS = Array.from({ length: 13 }, (_, i) => 1 - i);

function periodLabel(start: Date, end: Date, offset: number): string {
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} - ${endLabel}${offset === 0 ? ' (Current)' : ''}`;
}

export function ExportPage() {
  const [periodOffset, setPeriodOffset] = useState(0);
  const [employeeId, setEmployeeId] = useState('all');
  const filters = useMemo<EntryFilters>(() => {
    const { start, end } = getPayPeriodRangeByOffset(new Date(), periodOffset);
    return { from: toDateKey(start), to: toDateKey(end), employeeId };
  }, [periodOffset, employeeId]);
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
          <label htmlFor="period">Pay Period</label>
          <select id="period" value={periodOffset} onChange={(e) => setPeriodOffset(Number(e.target.value))}>
            {PERIOD_OFFSETS.map((offset) => {
              const { start, end } = getPayPeriodRangeByOffset(new Date(), offset);
              return (
                <option key={offset} value={offset}>
                  {periodLabel(start, end, offset)}
                </option>
              );
            })}
          </select>
        </div>
        <div className="fcol">
          <label htmlFor="employee">Employee</label>
          <select id="employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
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
        One row per employee for the selected pay period, matching GRIN's own ExcelTimeClock import format (EmployeeID,
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
