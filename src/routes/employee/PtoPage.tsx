import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePtoRequests } from '../../hooks/usePtoRequests';
import { formatDate } from '../../lib/time';
import type { Database } from '../../lib/database.types';

type PtoType = Database['public']['Tables']['pto_requests']['Row']['pto_type'];

const TAG_CLASS: Record<string, string> = { approved: 'ok', pending: 'hot', denied: 'danger' };

export function PtoPage() {
  const { profile, refreshProfile } = useAuth();
  const { requests, loading, error, submit, cancel } = usePtoRequests(profile?.id);

  // profile.pto_balance_hours is cached in AuthProvider for the session, but
  // it changes whenever an admin approves a request - refetch it whenever
  // this page is visited via client-side navigation (not just a hard reload).
  useEffect(() => {
    void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [ptoType, setPtoType] = useState<PtoType>('pto');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const balance = profile?.pto_balance_hours ?? 0;
  const requestedHours = Number(hours);
  const exceedsBalance = !Number.isNaN(requestedHours) && requestedHours > balance;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!startDate || !endDate || !hours) {
      setFormError('Fill in all fields.');
      return;
    }
    if (endDate < startDate) {
      setFormError('End date must be on or after the start date.');
      return;
    }
    setSubmitting(true);
    const { error } = await submit({ ptoType, startDate, endDate, hours: requestedHours });
    setSubmitting(false);
    if (error) setFormError(error);
    else {
      setStartDate('');
      setEndDate('');
      setHours('');
    }
  }

  return (
    <div>
      <h1>
        PTO &amp; Sick <span>Time</span>
      </h1>
      <p className="sub">Request time off and track your balance.</p>

      <div className="card kpi" style={{ maxWidth: 220 }}>
        <div className="label">Balance</div>
        <div className="big">{balance.toFixed(2)}</div>
        <div className="unit">hours available</div>
      </div>
      <p className="form-hint">
        Accrues automatically: 40 hours every January 1st, plus about 3.08 hours every 2-week pay period.
      </p>

      <div className="section-head">
        <span className="num">1</span>
        <h2>Request Time Off</h2>
      </div>
      <form className="entry-form" onSubmit={(e) => void handleSubmit(e)}>
        <label htmlFor="pto-type">Type</label>
        <select id="pto-type" value={ptoType} onChange={(e) => setPtoType(e.target.value as PtoType)}>
          <option value="pto">PTO</option>
          <option value="sick">Sick</option>
        </select>

        <label htmlFor="start-date">Start date</label>
        <input id="start-date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />

        <label htmlFor="end-date">End date</label>
        <input id="end-date" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <label htmlFor="hours">Hours requested</label>
        <input
          id="hours"
          type="number"
          min="0.25"
          step="0.25"
          required
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        {exceedsBalance && <p className="form-hint">This exceeds your current balance. Your admin will see that too.</p>}

        {formError && <p className="form-error">{formError}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-build" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>

      <div className="section-head">
        <span className="num">2</span>
        <h2>Your Requests</h2>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && requests.length === 0 && <p>No PTO requests yet.</p>}
      {requests.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Hours</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="row">
                  <td>{r.pto_type === 'pto' ? 'PTO' : 'Sick'}</td>
                  <td>
                    {formatDate(r.start_date)} - {formatDate(r.end_date)}
                    {r.notes && <div className="row-reason">Note: {r.notes}</div>}
                  </td>
                  <td className="num">{r.hours_requested}</td>
                  <td>
                    <span className={`tag ${TAG_CLASS[r.status]}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <button type="button" className="btn-clear" onClick={() => void cancel(r.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
