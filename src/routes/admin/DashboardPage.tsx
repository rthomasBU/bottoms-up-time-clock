import { Link } from 'react-router-dom';
import { useAdminDashboard } from '../../hooks/useAdminDashboard';
import { elapsedSince, formatTime } from '../../lib/time';

export function DashboardPage() {
  const { clockedIn, pendingPtoCount, loading, error } = useAdminDashboard();

  return (
    <div>
      <h1>
        Admin <span>Dashboard</span>
      </h1>
      <p className="sub">Who's on the clock right now, and what needs your attention.</p>
      {error && <p className="form-error">{error}</p>}

      <div className="kpis" style={{ maxWidth: 220 }}>
        <Link to="/admin/pto" className="card kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="label">PTO Awaiting Approval</div>
          <div className={`big ${pendingPtoCount > 0 ? 'danger' : 'ok'}`}>{pendingPtoCount}</div>
          <div className="unit">requests</div>
        </Link>
      </div>

      <div className="section-head">
        <span className="num">1</span>
        <h2>Currently Clocked In</h2>
      </div>
      {loading && <p>Loading...</p>}
      {!loading && clockedIn.length === 0 && <p>Nobody is clocked in right now.</p>}
      {clockedIn.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Since</th>
                <th>Elapsed</th>
              </tr>
            </thead>
            <tbody>
              {clockedIn.map((row) => (
                <tr key={row.id} className="row">
                  <td>{row.full_name}</td>
                  <td>{formatTime(row.clock_in)}</td>
                  <td>{elapsedSince(row.clock_in)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
