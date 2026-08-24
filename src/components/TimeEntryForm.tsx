import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useEmployees } from '../hooks/useEmployees';
import { toDatetimeLocalValue, fromDatetimeLocalValue, daysAgo } from '../lib/time';

const SELF_EDIT_WINDOW_DAYS = 14;

interface TimeEntryFormProps {
  /** 'admin' can pick any employee and isn't bound by the edit window.
   *  'self' is fixed to the current user and limited to the last 14 days,
   *  matching the RLS policies in 0004_remove_time_entry_approval.sql. */
  mode: 'admin' | 'self';
  /** Where to navigate after a successful save or Cancel. */
  redirectTo: string;
}

export function TimeEntryForm({ mode, redirectTo }: TimeEntryFormProps) {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { employees } = useEmployees();

  const [employeeId, setEmployeeId] = useState(mode === 'self' ? (profile?.id ?? '') : '');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [editReason, setEditReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minClockIn = mode === 'self' ? toDatetimeLocalValue(daysAgo(SELF_EDIT_WINDOW_DAYS).toISOString()) : undefined;

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data, error } = await supabase.from('time_entries').select('*').eq('id', id).single();
      if (error) {
        setError(error.message);
      } else if (data) {
        setEmployeeId(data.employee_id);
        setClockIn(toDatetimeLocalValue(data.clock_in));
        setClockOut(data.clock_out ? toDatetimeLocalValue(data.clock_out) : '');
        setNotes(data.notes ?? '');
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!editReason.trim()) {
      setError('A reason is required so there is a clear record of what changed.');
      return;
    }
    if (mode === 'self' && minClockIn && clockIn < minClockIn) {
      setError(`You can only add or edit entries from the last ${SELF_EDIT_WINDOW_DAYS} days. Ask an admin to fix anything older.`);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      employee_id: mode === 'self' ? (profile.id) : employeeId,
      clock_in: fromDatetimeLocalValue(clockIn),
      clock_out: clockOut ? fromDatetimeLocalValue(clockOut) : null,
      notes: notes || null,
      edited_by: profile.id,
      edit_reason: editReason.trim(),
    };

    const result = isNew
      ? await supabase
          .from('time_entries')
          .insert({ ...payload, source: mode === 'admin' ? 'admin_manual' : 'self' })
      : await supabase.from('time_entries').update(payload).eq('id', id);

    setSaving(false);
    if (result.error) setError(result.error.message);
    else navigate(redirectTo);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>
        {isNew ? 'Add Time' : 'Edit Time'} <span>Entry</span>
      </h1>
      <p className="sub">
        {mode === 'self'
          ? `Corrections require a reason and must be within the last ${SELF_EDIT_WINDOW_DAYS} days.`
          : "Corrections require a note so there's a clear record of what changed."}
      </p>
      <form className="entry-form" onSubmit={(e) => void handleSubmit(e)}>
        {mode === 'admin' && (
          <>
            <label htmlFor="employee">Employee</label>
            <select
              id="employee"
              required
              disabled={!isNew}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="" disabled>
                Select employee...
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </>
        )}

        <label htmlFor="clock-in">Clock in</label>
        <input
          id="clock-in"
          type="datetime-local"
          required
          min={minClockIn}
          value={clockIn}
          onChange={(e) => setClockIn(e.target.value)}
        />

        <label htmlFor="clock-out">Clock out (leave blank if still open)</label>
        <input
          id="clock-out"
          type="datetime-local"
          min={minClockIn}
          value={clockOut}
          onChange={(e) => setClockOut(e.target.value)}
        />

        <label htmlFor="edit-reason">Reason (required)</label>
        <textarea
          id="edit-reason"
          required
          rows={2}
          placeholder="e.g. Forgot to clock out on 8/22"
          value={editReason}
          onChange={(e) => setEditReason(e.target.value)}
        />

        <label htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-build" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="btn-clear" onClick={() => navigate(redirectTo)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
