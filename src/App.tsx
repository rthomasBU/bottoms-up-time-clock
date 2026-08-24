import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RoleGuard } from './components/layout/RoleGuard';
import { LoginPage } from './routes/auth/LoginPage';
import { AccountPage } from './routes/auth/AccountPage';
import { ClockPage } from './routes/employee/ClockPage';
import { TimesheetHistoryPage } from './routes/employee/TimesheetHistoryPage';
import { PtoPage } from './routes/employee/PtoPage';
import { CalendarPage } from './routes/employee/CalendarPage';
import { DashboardPage } from './routes/admin/DashboardPage';
import { TimesheetsPage } from './routes/admin/TimesheetsPage';
import { TimeEntryEditPage as AdminTimeEntryEditPage } from './routes/admin/TimeEntryEditPage';
import { PtoApprovalPage } from './routes/admin/PtoApprovalPage';
import { ExportPage } from './routes/admin/ExportPage';
import { HolidaysPage } from './routes/admin/HolidaysPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route
          path="/"
          element={
            <RoleGuard allow={['employee', 'admin']}>
              <ClockPage />
            </RoleGuard>
          }
        />
        <Route
          path="/timesheet"
          element={
            <RoleGuard allow={['employee', 'admin']}>
              <TimesheetHistoryPage />
            </RoleGuard>
          }
        />
        <Route
          path="/account"
          element={
            <RoleGuard allow={['employee', 'admin']}>
              <AccountPage />
            </RoleGuard>
          }
        />
        <Route
          path="/calendar"
          element={
            <RoleGuard allow={['employee', 'admin']}>
              <CalendarPage />
            </RoleGuard>
          }
        />
        <Route
          path="/pto"
          element={
            <RoleGuard allow={['employee', 'admin']}>
              <PtoPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleGuard allow={['admin']}>
              <DashboardPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/timesheets"
          element={
            <RoleGuard allow={['admin']}>
              <TimesheetsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/entries/new"
          element={
            <RoleGuard allow={['admin']}>
              <AdminTimeEntryEditPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/entries/:id"
          element={
            <RoleGuard allow={['admin']}>
              <AdminTimeEntryEditPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/pto"
          element={
            <RoleGuard allow={['admin']}>
              <PtoApprovalPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/export"
          element={
            <RoleGuard allow={['admin']}>
              <ExportPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/holidays"
          element={
            <RoleGuard allow={['admin']}>
              <HolidaysPage />
            </RoleGuard>
          }
        />
      </Route>
    </Routes>
  );
}
