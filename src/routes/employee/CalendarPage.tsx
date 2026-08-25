import { useMemo, useState } from 'react';
import { useHolidays } from '../../hooks/useHolidays';
import { useTeamPto } from '../../hooks/useTeamPto';
import { getMonthGrid, getPaydaysInRange, toDateKey } from '../../lib/payroll';
import { MonthCalendar, type CalendarEvent } from '../../components/MonthCalendar';

export function CalendarPage() {
  const [month, setMonth] = useState(() => new Date());

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
      isPayday: true,
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

  return (
    <div>
      <h1>
        Company <span>Calendar</span>
      </h1>
      <p className="sub">Paydays, holidays, and everyone's approved time off.</p>
      <MonthCalendar month={month} onPrevMonth={prevMonth} onNextMonth={nextMonth} events={events} />
    </div>
  );
}
