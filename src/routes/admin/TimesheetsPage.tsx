import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminTimeEntries, defaultFilters, type AdminTimeEntryRow } from '../../hooks/useAdminTimeEntries';
import { useEmployees } from '../../hooks/useEmployees';
import { hoursBetween, formatTime } from '../../lib/time';
import { mapLinkUrl } from '../../lib/geolocation';
import { groupByDay, groupByPayPeriod } from '../../lib/timesheetGrouping';
import type { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface EmployeeGroup {
  employeeId: string;
  fullName: string;
  totalHours: number;
  entries: AdminTimeEntryRow[];
}

/** One group per employee, in the same (alphabetical) order the employee
 *  list comes in - including employees with zero entries in the selected
 *  range, so the roster is always complete rather than only showing
 *  whoever happened to have hours. */
function buildEmployeeGroups(employees: Profile[], entries: AdminTimeEntryRow[]): EmployeeGroup[] {
  const entriesByEmployee = new Map<string, AdminTimeEntryRow[]>();
  for (const entry of entries) {
    const list = entriesByEmployee.get(entry.employee_id);
    if (list) list.push(entry);
    else entriesByEmployee.set(entry.employee_id, [entry]);
  }
  return employees.map((emp) => {
    const empEntries = entriesByEmployee.get(emp.id) ?? [];
    const totalHours = empEntries.reduce(
      (sum, e) => (e.clock_out ? sum + hoursBetween(e.clock_in, e.clock_out) : sum),
      0,
    );
    return { employeeId: emp.id, fullName: emp.full_name, totalHours, entries: empEntries };
  });
}

export function TimesheetsPage() {
  const [filters, setFilters] = useState(defaultFilters());
  const { entries, loading, error } = useAdminTimeEntries(filters);
  const { employees } = useEmployees();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const visibleEmployees = useMemo(
    () => (filters.employeeId === 'all' ? employees : employees.filter((emp) => emp.id === filters.employeeId)),
    [employees, filters.employeeId],
  );
  const groups = useMemo(() => buildEmployeeGroups(visibleEmployees, entries), [visibleEmployees, entries]);

  // Filtering down to one employee always shows them expanded (there's
  // nothing else on the page to toggle); otherwise expansion is manual and
  // starts collapsed, so a full 10-15 person roster doesn't dump every
  // pay-period/day breakdown on screen at once.
  function isExpanded(employeeId: string) {
    return filters.employeeId !== 'all' || expandedIds.has(employeeId);
  }

  function toggle(employeeId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

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
      {!loading && groups.length === 0 && <p>No employees match these filters.</p>}

      {groups.map((group, i) => {
        const expanded = isExpanded(group.employeeId);
        return (
        <div key={group.employeeId}>
          <div className="section-head">
            <button
              type="button"
              className="section-head-toggle"
              onClick={() => toggle(group.employeeId)}
              aria-expanded={expanded}
              disabled={filters.employeeId !== 'all'}
            >
              <span className="num">{i + 1}</span>
              <h2>{group.fullName}</h2>
              <span className={`tag ${group.totalHours > 0 ? 'ok' : 'muted'}`} style={{ marginLeft: 'auto' }}>
                {group.totalHours.toFixed(2)} hrs
              </span>
              {filters.employeeId === 'all' && (
                <span className="chevron" aria-hidden="true">
                  {expanded ? '▾' : '▸'}
                </span>
              )}
            </button>
          </div>

          {expanded && group.entries.length === 0 && <p className="form-hint">No entries in this range.</p>}

          {expanded && groupByPayPeriod(group.entries).map((period) => (
            <div key={period.periodKey}>
              <div className="period-head">
                <span className="period-label">Pay Period: {period.label}</span>
                <span className="tag muted">{period.totalHours.toFixed(2)} hrs</span>
              </div>

              {groupByDay(period.entries).map((day) => (
                <div key={day.dateKey}>
                  <div className="day-head">
                    <span className="day-label">{day.label}</span>
                    <span className="tag muted">{day.totalHours.toFixed(2)} hrs</span>
                  </div>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Clock In</th>
                          <th>Clock Out</th>
                          <th>Hours</th>
                          <th></th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.entries.map((entry) => (
                          <tr key={entry.id} className="row">
                            <td>
                              {formatTime(entry.clock_in)}
                              {entry.clock_in_lat != null && entry.clock_in_lng != null && (
                                <>
                                  {' '}
                                  <a
                                    href={mapLinkUrl(entry.clock_in_lat, entry.clock_in_lng)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="row-map-link"
                                  >
                                    map
                                  </a>
                                </>
                              )}
                            </td>
                            <td>
                              {entry.clock_out ? formatTime(entry.clock_out) : 'still clocked in'}
                              {entry.clock_out_lat != null && entry.clock_out_lng != null && (
                                <>
                                  {' '}
                                  <a
                                    href={mapLinkUrl(entry.clock_out_lat, entry.clock_out_lng)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="row-map-link"
                                  >
                                    map
                                  </a>
                                </>
                              )}
                            </td>
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
                </div>
              ))}
            </div>
          ))}
        </div>
        );
      })}
    </div>
  );
}
