import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminTimeEntries, defaultFilters } from '../../hooks/useAdminTimeEntries';
import { useEmployees } from '../../hooks/useEmployees';
import { hoursBetween, formatDateTime } from '../../lib/time';

export function TimesheetsPage() {
  const [filters, setFilters] = useState(defaultFilters());
  const { entries, loading, error } = useAdminTimeEntries(filters);
  const { employees } = useEmployees();

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h1>
          Timesheets <span>Browser</span>
        </h1>
        <Link to="/admin/entries/new" className="btn-build">
          + Add Entry
        </Link>
      </div>
      <p className="sub">Browse and correct any employee's hours. Nothing here needs approval.</p>

      <div className="filter-row">
        <div className="fcol">
          <label htmlFor="from">From</label>
          <input
            id="from"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </div>
        <div className="fcol">
          <label htmlFor="to">To</label>
          <input
            id="to"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        <div className="fcol">
          <label htmlFor="employee">Employee</label>
          <select
            id="employee"
            value={filters.employeeId}
            onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
          >
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
      {!loading && entries.length === 0 && <p>No entries match these filters.</p>}

      {entries.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Hours</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="row">
                  <td>{entry.profiles?.full_name ?? 'Unknown'}</td>
                  <td>{formatDateTime(entry.clock_in)}</td>
                  <td>{entry.clock_out ? formatDateTime(entry.clock_out) : 'still clocked in'}</td>
                  <td className="num">
                    {entry.clock_out ? hoursBetween(entry.clock_in, entry.clock_out).toFixed(2) : '-'}
                  </td>
                  <td>
                    {entry.edited_by && (
                      <>
                        <span className="tag muted">{entry.source === 'self' ? 'self-edited' : 'admin-edited'}</span>
                        {entry.edit_reason && <div className="row-reason">Note: {entry.edit_reason}</div>}
                      </>
                    )}
                  </td>
                  <td>
                    <Link to={`/admin/entries/${entry.id}`} className="btn-clear">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
