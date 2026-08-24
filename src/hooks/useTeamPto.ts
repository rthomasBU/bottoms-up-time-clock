import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type PtoRequest = Database['public']['Tables']['pto_requests']['Row'];
export type TeamPtoRow = PtoRequest & { profiles: { full_name: string } | null };

/** Every employee's approved PTO/sick time overlapping a date range - the
 *  "who's out" calendar view. Relies on the additive
 *  pto_requests_select_approved_all RLS policy (0006_holidays_and_calendar.sql);
 *  pending/denied requests stay invisible to everyone but their owner + admin. */
export function useTeamPto(fromDateKey: string, toDateKey: string) {
  const [requests, setRequests] = useState<TeamPtoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pto_requests')
      .select('*, profiles!pto_requests_employee_id_fkey(full_name)')
      .eq('status', 'approved')
      .lte('start_date', toDateKey)
      .gte('end_date', fromDateKey);
    if (error) setError(error.message);
    else {
      setError(null);
      setRequests((data ?? []) as unknown as TeamPtoRow[]);
    }
    setLoading(false);
  }, [fromDateKey, toDateKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { requests, loading, error, refresh };
}
