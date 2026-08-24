import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function NavBar() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  const isAdmin = profile.role === 'admin';
  const isHourly = profile.pay_type === 'hourly';
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

  return (
    <nav className="appnav">
      <NavLink to="/" end className={linkClass}>
        {isHourly ? 'Clock' : 'Home'}
      </NavLink>
      <NavLink to="/timesheet" className={linkClass}>
        Timesheet
      </NavLink>
      <NavLink to="/calendar" className={linkClass}>
        Calendar
      </NavLink>
      <NavLink to="/pto" className={linkClass}>
        PTO
      </NavLink>
      {isAdmin && (
        <>
          <NavLink to="/admin" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/timesheets" className={linkClass}>
            Timesheets
          </NavLink>
          <NavLink to="/admin/pto" className={linkClass}>
            Approve PTO
          </NavLink>
          <NavLink to="/admin/export" className={linkClass}>
            Export
          </NavLink>
          <NavLink to="/admin/holidays" className={linkClass}>
            Holidays
          </NavLink>
        </>
      )}
      <div className="appnav-right">
        <NavLink to="/account" className={linkClass}>
          {profile.full_name}
        </NavLink>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  );
}
