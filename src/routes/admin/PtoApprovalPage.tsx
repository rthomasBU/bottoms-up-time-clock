import { useState } from 'react';
import { useAdminPto } from '../../hooks/useAdminPto';
import { formatDate } from '../../lib/time';

const TAG_CLASS: Record<string, string> = { approved: 'ok', pending: 'hot', denied: 'danger' };

export function PtoApprovalPage() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const { requests, loading, error, review } = useAdminPto(statusFilter);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleReview(id: string, approve: boolean) {
    setBusyId(id);
    setActionError(null);
    const { error } = await review(id, approve);
    if (error) setActionError(error);
    setBusyId(null);
  }

  return (
    <div>
      <h1>
        Approve <span>PTO</span>
      </h1>
      <p className="sub">Review and act on employee time-off requests.</p>

      <div className="filter-row">
        <div className="fcol">
          <label htmlFor="status">Status</label>
          <select id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'pending' | 'all')}>
            <option value="pending">Pending</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {actionError && <p className="form-error">{actionError}</p>}
      {loading && <p>Loading...</p>}
      {!loading && requests.length === 0 && <p>No requests match this filter.</p>}

      {requests.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
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
                  <td>{r.profiles?.full_name ?? 'Unknown'}</td>
                  <td>{r.pto_type === 'pto' ? 'PTO' : 'Sick'}</td>
                  <td>
                    {formatDate(r.start_date)} - {formatDate(r.end_date)}
                  </td>
                  <td className="num">{r.hours_requested}</td>
                  <td>
                    <span className={`tag ${TAG_CLASS[r.status]}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="pto-actions">
                        <button type="button" disabled={busyId === r.id} onClick={() => void handleReview(r.id, true)}>
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-clear"
                          disabled={busyId === r.id}
                          onClick={() => void handleReview(r.id, false)}
                        >
                          Deny
                        </button>
                      </div>
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
