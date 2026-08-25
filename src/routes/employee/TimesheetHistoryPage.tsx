import { useAuth } from '../../hooks/useAuth';
import { useTimesheet } from '../../hooks/useTimesheet';
import { hoursBetween, formatTime, formatDate } from '../../lib/time';
import { getCurrentPayPeriodRange } from '../../lib/payroll';
import type { Database } from '../../lib/database.types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];

/** Sum of closed entries' hours with clock_in inside [start, end]. */
function hoursInRange(entries: TimeEntry[], start: Date, end: Date): number {
  return entries.reduce((sum, e) => {
    if (!e.clock_out) return sum;
    const clockIn = new Date(e.clock_in);
    return clockIn >= start && clockIn <= end ? sum + hoursBetween(e.clock_in, e.clock_out) : sum;
  }, 0);
}

/** Sum of closed entries' hours with clock_in in the last `days` days. */
function hoursInLastDays(entries: TimeEntry[], days: number): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return hoursInRange(entries, cutoff, new Date());
}

export function TimesheetHistoryPage() {
  const { profile } = useAuth();
  const { entries, loading, error } = useTimesheet(profile?.id);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  const payPeriod = getCurrentPayPeriodRange(now);

  return (
    <div>
      <h1>
        Your <span>Timesheet</span>
      </h1>
      <p className="sub">Your clock in and clock out history for the last 60 days. Spot a mistake? Ask an admin to fix it.</p>

      <div className="kpis">
        <div className="card kpi">
          <div className="label">Today</div>
          <div className="big">{hoursInRange(entries, startOfToday, endOfToday).toFixed(2)}</div>
          <div className="unit">hours</div>
        </div>
        <div className="card kpi">
          <div className="label">Current Pay Period</div>
          <div className="big">{hoursInRange(entries, payPeriod.start, payPeriod.end).toFixed(2)}</div>
          <div className="unit">hours</div>
        </div>
        <div className="card kpi">
          <div className="label">Last 30 Days</div>
          <div className="big">{hoursInLastDays(entries, 30).toFixed(2)}</div>
          <div className="unit">hours</div>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Loading...</p>}
      {!loading && entries.length === 0 && <p>No time entries yet.</p>}

      {entries.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Hours</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="row">
                  <td>{formatDate(e.clock_in)}</td>
                  <td>
                    {formatTime(e.clock_in)} - {e.clock_out ? formatTime(e.clock_out) : 'now'}
                  </td>
                  <td className="num">{e.clock_out ? hoursBetween(e.clock_in, e.clock_out).toFixed(2) : '-'}</td>
                  <td>{e.edited_by && <span className="tag muted">{e.source === 'self' ? 'edited' : 'edited by admin'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
