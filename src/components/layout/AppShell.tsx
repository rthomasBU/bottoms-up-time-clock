import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Topbar } from './Topbar';
import { NavBar } from './NavBar';
import { InstallPrompt } from './InstallPrompt';

export function AppShell() {
  const { loading, profileError, session } = useAuth();

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="centered-message">
          <p>Loading...</p>
        </div>
      </>
    );
  }

  if (session && profileError) {
    return (
      <>
        <Topbar />
        <div className="centered-message">
          <p>Couldn't load your profile: {profileError}</p>
          <p>Contact an admin if this keeps happening.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar />
      <InstallPrompt />
      <div className="wrap">
        <NavBar />
        <Outlet />
      </div>
    </>
  );
}
