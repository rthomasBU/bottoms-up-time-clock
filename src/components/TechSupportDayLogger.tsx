import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTechSupportDays } from '../hooks/useTechSupportDays';
import { formatDate } from '../lib/time';
import { toDateKey } from '../lib/payroll';

const BACKDATE_WINDOW_DAYS = 14;

/** Tech support day logging, rendered on its own /tech-support tab -
 *  available to every employee regardless of pay_type. Same format as
 *  TravelDayLogger: logs every date in a start-end range at once (each date
 *  still becomes its own row - see useTechSupportDays); admins see
 *  everyone's on the Export page. */
export function TechSupportDayLogger() {
  const { profile } = useAuth();
  const { techSupportDays, loading, error, logTechSupportDays, deleteTechSupportDay } = useTechSupportDays(profile?.id);

  const today = new Date();
  const earliest = new Date();
  earliest.setDate(earliest.getDate() - BACKDATE_WINDOW_DAYS);
  const todayKey = toDateKey(today);
  const earliestKey = toDateKey(earliest);

  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (startDate > endDate) {
      setFormError('Start date must be on or before the end date.');
      return;
    }
    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const { logged, skipped } = await logTechSupportDays(profile.id, startDate, endDate, notes);
      setNotes('');
      if (logged === 0) {
        setFormError('Every date in that range was already logged.');
      } else {
        setSuccessMessage(
          `Logged ${logged} tech support day${logged === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} already logged, skipped)` : ''}.`,
        );
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setFormError(null);
    try {
      await deleteTechSupportDay(id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setDeletingId(null);
  }

  return (
    <div className="card tech-support-day-logger">
      <form className="entry-form" onSubmit={(e) => void handleSubmit(e)}>
        <label htmlFor="tech-support-start">Start date</label>
        <input
          id="tech-support-start"
          type="date"
          required
          min={earliestKey}
          max={todayKey}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <label htmlFor="tech-support-end">End date</label>
        <input
          id="tech-support-end"
          type="date"
          required
          min={earliestKey}
          max={todayKey}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <label htmlFor="tech-support-notes">Notes (optional)</label>
        <textarea
          id="tech-support-notes"
          rows={2}
          placeholder="e.g. Remote setup call with the Cincinnati install job"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {formError && <p className="form-error">{formError}</p>}
        {successMessage && <p className="form-success">{successMessage}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-build" disabled={saving}>
            {saving ? 'Logging...' : 'Log Tech Support'}
          </button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
      {!loading && techSupportDays.length > 0 && (
        <ul className="logged-day-list">
          {techSupportDays.map((day) => {
            const canDelete = new Date(day.created_at) >= earliest;
            return (
              <li key={day.id}>
                <span>{formatDate(day.support_date)}</span>
                {day.notes && <span className="row-detail">{day.notes}</span>}
                {canDelete && (
                  <button
                    type="button"
                    className="btn-clear"
                    disabled={deletingId === day.id}
                    onClick={() => void handleDelete(day.id)}
                  >
                    {deletingId === day.id ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
