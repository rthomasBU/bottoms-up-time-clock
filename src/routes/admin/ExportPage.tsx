import { useState } from 'react';
import { useAdminTimeEntries, type EntryFilters } from '../../hooks/useAdminTimeEntries';
import { useAdminTravelDays } from '../../hooks/useAdminTravelDays';
import { useEmployees } from '../../hooks/useEmployees';
import { hoursBetween, formatDateTime, formatDate } from '../../lib/time';
import { toCsv, downloadCsv } from '../../lib/csv';

function defaultExportFilters(): EntryFilters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return {
    from: from.toLocaleDateString('en-CA'),
    to: to.toLocaleDateString('en-CA'),
    employeeId: 'all',
  };
}

export function ExportPage() {
  const [filters, setFilters] = useState<EntryFilters>(defaultExportFilters());
  const { entries, loading, error } = useAdminTimeEntries(filters);
  const { travelDays, loading: travelDaysLoading, error: travelDaysError } = useAdminTravelDays(filters);
  const { employees } = useEmployees();

  const closedEntries = entries.filter((e) => e.clock_out);
  const totalHours = closedEntries.reduce((sum, e) => sum + hoursBetween(e.clock_in, e.clock_out!), 0);
  const openCount = entries.length - closedEntries.length;

  function handleExportCsv() {
    const rows = closedEntries.map((e) => ({
      employee: e.profiles?.full_name ?? 'Unknown',
      date: formatDate(e.clock_in),
      clock_in: formatDateTime(e.clock_in),
      clock_out: formatDateTime(e.clock_out!),
      hours: hoursBetween(e.clock_in, e.clock_out!).toFixed(2),
      type: e.edited_by ? 'Manual' : 'Live',
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

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Loading...</p>}

      <p className="form-hint">
        {closedEntries.length} entries, {totalHours.toFixed(2)} hours total
        {openCount > 0 && `, ${openCount} still clocked in (excluded)`}
      </p>

      <div className="export-actions no-print">
        <button type="button" className="btn-build" onClick={handleExportCsv} disabled={closedEntries.length === 0}>
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
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {closedEntries.map((e) => (
              <tr key={e.id} className="row">
                <td>{e.profiles?.full_name ?? 'Unknown'}</td>
                <td>{formatDate(e.clock_in)}</td>
                <td>{formatDateTime(e.clock_in)}</td>
                <td>{formatDateTime(e.clock_out!)}</td>
                <td className="num">{hoursBetween(e.clock_in, e.clock_out!).toFixed(2)}</td>
                <td>
                  <span className={`tag ${e.edited_by ? 'muted' : 'ok'}`}>{e.edited_by ? 'Manual' : 'Live'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-head">
        <span className="num">2</span>
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
