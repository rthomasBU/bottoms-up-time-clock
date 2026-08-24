import { TimeEntryForm } from '../../components/TimeEntryForm';

export function TimeEntryEditPage() {
  return <TimeEntryForm mode="admin" redirectTo="/admin/timesheets" />;
}
