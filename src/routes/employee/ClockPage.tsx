import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useClockStatus } from '../../hooks/useClockStatus';
import { useTimesheet } from '../../hooks/useTimesheet';
import { elapsedSince, formatTime, hoursBetween, getCurrentWeekRange } from '../../lib/time';

const WEEKLY_TARGET_HOURS = 40;

export function ClockPage() {
  const { profile } = useAuth();
  const { openEntry, loading, error, clockIn, clockOut } = useClockStatus(profile?.id);
  const { entries } = useTimesheet(profile?.id);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const weekHours = useMemo(() => {
    const { start, end } = getCurrentWeekRange(now);
    let total = 0;
    for (const e of entries) {
      const entryClockIn = new Date(e.clock_in);
      if (entryClockIn < start || entryClockIn > end) continue;
      if (e.clock_out) total += hoursBetween(e.clock_in, e.clock_out);
      else total += (now.getTime() - entryClockIn.getTime()) / 1000 / 60 / 60;
    }
    return total;
  }, [entries, now]);

  async function handleClick() {
    setBusy(true);
    if (openEntry) await clockOut();
    else await clockIn();
    setBusy(false);
  }

  const isSalaried = profile?.pay_type === 'salaried';

  return (
    <div className="clock-page">
      <h1>
        Time <span>Clock</span>
      </h1>
      <p className="sub">Welcome, {profile?.full_name}.</p>

      {isSalaried ? (
        <p>You're on salary, so there's no clock to punch. Head to the PTO tab to request time off.</p>
      ) : loading ? (
        <p>Loading status...</p>
      ) : (
        <>
          <div className="card clock-status">
            <div className="label">Status</div>
            {openEntry ? (
              <>
                <p>Clocked in at {formatTime(openEntry.clock_in)}</p>
                <p className="elapsed">{elapsedSince(openEntry.clock_in, now)} elapsed</p>
              </>
            ) : (
              <p>You're currently clocked out.</p>
            )}
          </div>
          <button
            type="button"
            className={`clock-button ${openEntry ? 'out' : 'in'}`}
            disabled={busy}
            onClick={() => void handleClick()}
          >
            {busy ? 'Working...' : openEntry ? 'Clock Out' : 'Clock In'}
          </button>

          <div className="card kpi week-progress">
            <div className="label">This Week</div>
            <div className="big">
              {weekHours.toFixed(2)} <span className="unit">/ {WEEKLY_TARGET_HOURS} hrs</span>
            </div>
            <progress value={Math.min(weekHours, WEEKLY_TARGET_HOURS)} max={WEEKLY_TARGET_HOURS} />
          </div>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
