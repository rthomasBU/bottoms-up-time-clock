import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useClockStatus } from '../../hooks/useClockStatus';
import { useHolidays } from '../../hooks/useHolidays';
import { useTeamPto } from '../../hooks/useTeamPto';
import { elapsedSince, formatTime } from '../../lib/time';
import { getMonthGrid, getPaydaysInRange, toDateKey } from '../../lib/payroll';
import { MonthCalendar, type CalendarEvent } from '../../components/MonthCalendar';

export function ClockPage() {
  const { profile } = useAuth();
  const { openEntry, loading, error, clockIn, clockOut } = useClockStatus(profile?.id);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    if (!openEntry) return;
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, [openEntry]);

  const grid = useMemo(() => getMonthGrid(month), [month]);
  const gridStart = grid[0].date;
  const gridEnd = grid[grid.length - 1].date;
  const gridStartKey = toDateKey(gridStart);
  const gridEndKey = toDateKey(gridEnd);

  const { holidays } = useHolidays();
  const { requests: teamPto } = useTeamPto(gridStartKey, gridEndKey);

  const events: CalendarEvent[] = useMemo(() => {
    const paydayEvents: CalendarEvent[] = getPaydaysInRange(gridStart, gridEnd).map((d) => ({
      dateKey: toDateKey(d),
      label: 'Payday',
      tagClass: 'ok',
    }));

    const holidayEvents: CalendarEvent[] = holidays
      .filter((h) => h.holiday_date >= gridStartKey && h.holiday_date <= gridEndKey)
      .map((h) => ({ dateKey: h.holiday_date, label: h.name, tagClass: 'muted' }));

    const ptoEvents: CalendarEvent[] = [];
    for (const r of teamPto) {
      const name = r.profiles?.full_name ?? 'Unknown';
      const label = `${r.pto_type === 'pto' ? 'PTO' : 'Sick'} - ${name}`;
      let d = new Date(`${r.start_date}T00:00:00`);
      const end = new Date(`${r.end_date}T00:00:00`);
      while (d <= end) {
        const key = toDateKey(d);
        if (key >= gridStartKey && key <= gridEndKey) ptoEvents.push({ dateKey: key, label, tagClass: 'hot' });
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    }

    return [...paydayEvents, ...holidayEvents, ...ptoEvents];
  }, [gridStart, gridEnd, gridStartKey, gridEndKey, holidays, teamPto]);

  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

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
        </>
      )}
      {error && <p className="form-error">{error}</p>}

      <MonthCalendar month={month} onPrevMonth={prevMonth} onNextMonth={nextMonth} events={events} />
    </div>
  );
}
