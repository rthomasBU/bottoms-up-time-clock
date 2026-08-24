import { getMonthGrid, toDateKey } from '../lib/payroll';

export interface CalendarEvent {
  dateKey: string; // yyyy-mm-dd
  label: string;
  tagClass: 'ok' | 'muted' | 'hot';
}

interface MonthCalendarProps {
  month: Date; // any date within the month to display
  onPrevMonth: () => void;
  onNextMonth: () => void;
  events: CalendarEvent[];
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABEL = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export function MonthCalendar({ month, onPrevMonth, onNextMonth, events }: MonthCalendarProps) {
  const days = getMonthGrid(month);
  const todayKey = toDateKey(new Date());

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const bucket = eventsByDay.get(event.dateKey);
    if (bucket) bucket.push(event);
    else eventsByDay.set(event.dateKey, [event]);
  }

  return (
    <div className="calendar card">
      <div className="calendar-header">
        <button type="button" className="btn-clear" onClick={onPrevMonth} aria-label="Previous month">
          &lt; Prev
        </button>
        <div className="calendar-month-label">{MONTH_LABEL(month)}</div>
        <button type="button" className="btn-clear" onClick={onNextMonth} aria-label="Next month">
          Next &gt;
        </button>
      </div>

      <div className="calendar-scroll">
        <div className="calendar-grid calendar-weekdays">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {days.map(({ date, inCurrentMonth }) => {
            const dateKey = toDateKey(date);
            const dayEvents = eventsByDay.get(dateKey) ?? [];
            const isToday = dateKey === todayKey;
            return (
              <div
                key={dateKey}
                className={`calendar-day${inCurrentMonth ? '' : ' calendar-day-outside'}${isToday ? ' calendar-day-today' : ''}`}
              >
                <div className="calendar-day-number">{date.getDate()}</div>
                {dayEvents.map((event, i) => (
                  <span key={i} className={`tag ${event.tagClass} calendar-event`}>
                    {event.label}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
