import { useEffect, useState } from 'react';
import { getMonthGrid, toDateKey } from '../lib/payroll';

export interface CalendarEvent {
  dateKey: string; // yyyy-mm-dd
  label: string;
  tagClass: 'ok' | 'muted' | 'hot';
  /** Paydays render inline next to the date number instead of stacked with
   *  the day's other events, since they're a single deterministic event
   *  worth seeing at a glance without opening the day. */
  isPayday?: boolean;
}

interface MonthCalendarProps {
  month: Date; // any date within the month to display
  onPrevMonth: () => void;
  onNextMonth: () => void;
  events: CalendarEvent[];
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABEL = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const DAY_LABEL = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const MAX_VISIBLE_EVENTS = 2;

export function MonthCalendar({ month, onPrevMonth, onNextMonth, events }: MonthCalendarProps) {
  const days = getMonthGrid(month);
  const todayKey = toDateKey(new Date());
  const [openDateKey, setOpenDateKey] = useState<string | null>(null);

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const bucket = eventsByDay.get(event.dateKey);
    if (bucket) bucket.push(event);
    else eventsByDay.set(event.dateKey, [event]);
  }

  useEffect(() => {
    if (!openDateKey) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenDateKey(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openDateKey]);

  const openDay = days.find((d) => toDateKey(d.date) === openDateKey);
  const openDayEvents = openDateKey ? (eventsByDay.get(openDateKey) ?? []) : [];

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
            const paydayEvent = dayEvents.find((e) => e.isPayday);
            const otherEvents = dayEvents.filter((e) => !e.isPayday);
            const isToday = dateKey === todayKey;
            const visible = otherEvents.slice(0, MAX_VISIBLE_EVENTS);
            const hiddenCount = otherEvents.length - visible.length;
            return (
              <button
                type="button"
                key={dateKey}
                onClick={() => setOpenDateKey(dateKey)}
                aria-label={`${DAY_LABEL(date)}${dayEvents.length > 0 ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''}`}
                className={`calendar-day${inCurrentMonth ? '' : ' calendar-day-outside'}${isToday ? ' calendar-day-today' : ''}`}
              >
                <div className="calendar-day-top">
                  <span className="calendar-day-number">{date.getDate()}</span>
                  {paydayEvent && <span className={`tag ${paydayEvent.tagClass} calendar-event calendar-payday`}>{paydayEvent.label}</span>}
                </div>
                {visible.map((event, i) => (
                  <span key={i} className={`tag ${event.tagClass} calendar-event`}>
                    {event.label}
                  </span>
                ))}
                {hiddenCount > 0 && <span className="tag muted calendar-event calendar-more">+{hiddenCount} more</span>}
              </button>
            );
          })}
        </div>
      </div>

      {openDay && (
        <div className="modal" onClick={() => setOpenDateKey(null)}>
          <div
            className="modal-box modal-box-small"
            role="dialog"
            aria-modal="true"
            aria-label={DAY_LABEL(openDay.date)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>{DAY_LABEL(openDay.date)}</h2>
              <button type="button" className="btn-clear modal-close" onClick={() => setOpenDateKey(null)} aria-label="Close">
                Close
              </button>
            </div>
            <div className="modal-day-events">
              {openDayEvents.length === 0 ? (
                <p className="form-hint">Nothing scheduled.</p>
              ) : (
                <ul>
                  {openDayEvents.map((event, i) => (
                    <li key={i}>
                      <span className={`tag ${event.tagClass}`}>{event.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
