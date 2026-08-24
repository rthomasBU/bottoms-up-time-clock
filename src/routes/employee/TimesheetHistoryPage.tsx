import { useAuth } from '../../hooks/useAuth';
import { useTimesheet } from '../../hooks/useTimesheet';
import { hoursBetween, formatTime, formatDate } from '../../lib/time';

export function TimesheetHistoryPage() {
  const { profile } = useAuth();
  const { entries, loading, error } = useTimesheet(profile?.id);

  const periodTotal = entries.reduce(
    (sum, e) => (e.clock_out ? sum + hoursBetween(e.clock_in, e.clock_out) : sum),
    0,
  );

  return (
    <div>
      <h1>
        Your <span>Timesheet</span>
      </h1>
      <p className="sub">Your clock in and clock out history for the last 60 days. Spot a mistake? Ask an admin to fix it.</p>

      <div className="card kpi" style={{ maxWidth: 220 }}>
        <div className="label">Period Total</div>
        <div className="big">{periodTotal.toFixed(2)}</div>
        <div className="unit">hours</div>
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
