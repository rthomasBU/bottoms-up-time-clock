import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminTimeEntries, defaultFilters, type AdminTimeEntryRow } from '../../hooks/useAdminTimeEntries';
import { useEmployees } from '../../hooks/useEmployees';
import { hoursBetween, formatTime } from '../../lib/time';
import { mapLinkUrl } from '../../lib/geolocation';
import { getPayPeriodRange, toDateKey } from '../../lib/payroll';
import { groupByDay, groupByPayPeriod } from '../../lib/timesheetGrouping';
import type { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface EmployeeGroup {
  employeeId: string;
  fullName: string;
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
  return employees.map((emp) => ({
    employeeId: emp.id,
    fullName: emp.full_name,
    entries: entriesByEmployee.get(emp.id) ?? [],
  }));
}

/** Closed-entry hours per employee, e.g. for the current-pay-period total
 *  shown on each employee's row (independent of the From/To range below -
 *  see the separate currentPeriodEntries fetch in the component). */
function hoursByEmployee(entries: AdminTimeEntryRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.clock_out) continue;
    totals.set(entry.employee_id, (totals.get(entry.employee_id) ?? 0) + hoursBetween(entry.clock_in, entry.clock_out));
  }
  return totals;
}

export function TimesheetsPage() {
  const [filters, setFilters] = useState(defaultFilters());
  const { entries, loading, error } = useAdminTimeEntries(filters);
  const { employees } = useEmployees();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

  // The row-level total is always "hours this pay period", regardless of
  // whatever From/To range is selected below for browsing/correcting - so
  // it needs its own fetch pinned to the current period, not derived from
  // `entries`.
  const currentPeriod = useMemo(() => getPayPeriodRange(new Date()), []);
  const currentPeriodFilters = useMemo(
    () => ({ from: toDateKey(currentPeriod.start), to: toDateKey(currentPeriod.end), employeeId: 'all' as const }),
    [currentPeriod],
  );
  const { entries: currentPeriodEntries } = useAdminTimeEntries(currentPeriodFilters);
  const currentPeriodTotals = useMemo(() => hoursByEmployee(currentPeriodEntries), [currentPeriodEntries]);

  const groups = useMemo(() => buildEmployeeGroups(employees, entries), [employees, entries]);

  // Starts collapsed for everyone - expanding a specific employee (instead
  // of filtering the whole page down to just them) is how you drill into
  // one person's hours here, so a full 10-15 person roster doesn't dump
  // every pay-period/day breakdown on screen at once.
  function isExpanded(employeeId: string) {
    return expandedIds.has(employeeId);
  }

  function toggle(employeeId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  // Periods are keyed by employeeId+periodKey (not periodKey alone) so
  // expanding one employee's "Aug 24 - Sep 6" period doesn't also expand
  // another employee's row for the same calendar period.
  function isPeriodExpanded(employeeId: string, periodKey: string) {
    return expandedPeriods.has(`${employeeId}|${periodKey}`);
  }

  function togglePeriod(employeeId: string, periodKey: string) {
    const key = `${employeeId}|${periodKey}`;
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && groups.length === 0 && <p>No employees match these filters.</p>}

      {groups.map((group, i) => {
        const expanded = isExpanded(group.employeeId);
        const periodTotal = currentPeriodTotals.get(group.employeeId) ?? 0;
        return (
        <div key={group.employeeId}>
          <div className="section-head">
            <button
              type="button"
              className="section-head-toggle"
              onClick={() => toggle(group.employeeId)}
              aria-expanded={expanded}
            >
              <span className="num">{i + 1}</span>
              <h2>{group.fullName}</h2>
              <span className={`tag ${periodTotal > 0 ? 'ok' : 'muted'}`} style={{ marginLeft: 'auto' }}>
                {periodTotal.toFixed(2)} hrs this period
              </span>
              <span className="chevron" aria-hidden="true">
                {expanded ? '▾' : '▸'}
              </span>
            </button>
          </div>

          {expanded && group.entries.length === 0 && <p className="form-hint">No entries in this range.</p>}

          {expanded && groupByPayPeriod(group.entries).map((period) => {
            const periodExpanded = isPeriodExpanded(group.employeeId, period.periodKey);
            return (
            <div key={period.periodKey}>
              <div className="period-head">
                <button
                  type="button"
                  className="period-head-toggle"
                  onClick={() => togglePeriod(group.employeeId, period.periodKey)}
                  aria-expanded={periodExpanded}
                >
                  <span className="period-label">Pay Period: {period.label}</span>
                  <span className="tag muted" style={{ marginLeft: 'auto' }}>
                    {period.totalHours.toFixed(2)} hrs
                  </span>
                  <span className="chevron" aria-hidden="true">
                    {periodExpanded ? '▾' : '▸'}
                  </span>
                </button>
              </div>

              {periodExpanded && groupByDay(period.entries).map((day) => (
                <div key={day.dateKey}>
                  <div className="day-head">
                    <span className="day-label">{day.label}</span>
                    <span className="tag muted">{day.totalHours.toFixed(2)} hrs</span>
                  </div>
                  <div className="tablewrap">
                    <table className="entries-table">
                      <colgroup>
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '13%' }} />
                        <col />
                        <col style={{ width: '9%' }} />
                      </colgroup>
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
            );
          })}
        </div>
        );
      })}
    </div>
  );
}
