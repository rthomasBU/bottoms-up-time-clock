import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ClockedInRow {
  id: string;
  clock_in: string;
  employee_id: string;
  full_name: string;
  pay_type: string;
}

/** Admin view: who's currently clocked in, and how many PTO requests need a decision
 *  (the only approval-driven number left in the app - time entries no longer need one). */
export function useAdminDashboard() {
  const [clockedIn, setClockedIn] = useState<ClockedInRow[]>([]);
  const [pendingPtoCount, setPendingPtoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [clockedInRes, pendingPtoRes] = await Promise.all([
      supabase
        .from('time_entries')
        .select('id, clock_in, employee_id, profiles!time_entries_employee_id_fkey(full_name, pay_type)')
        .is('clock_out', null)
        .order('clock_in', { ascending: true }),
      supabase.from('pto_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    if (clockedInRes.error) {
      setError(clockedInRes.error.message);
    } else {
      setError(null);
      setClockedIn(
        (clockedInRes.data ?? []).map((row) => {
          const profile = row.profiles as unknown as { full_name: string; pay_type: string } | null;
          return {
            id: row.id,
            clock_in: row.clock_in,
            employee_id: row.employee_id,
            full_name: profile?.full_name ?? 'Unknown',
            pay_type: profile?.pay_type ?? 'hourly',
          };
        }),
      );
    }

    if (!pendingPtoRes.error) setPendingPtoCount(pendingPtoRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { clockedIn, pendingPtoCount, loading, error, refresh };
}
