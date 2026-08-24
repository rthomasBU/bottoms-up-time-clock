import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type PtoRequest = Database['public']['Tables']['pto_requests']['Row'];
export type TeamPtoRow = PtoRequest & { profiles: { full_name: string } | null };

/** Every employee's approved PTO/sick time overlapping a date range - the
 *  "who's out" calendar view. Relies on the additive
 *  pto_requests_select_approved_all RLS policy (0006_holidays_and_calendar.sql);
 *  pending/denied requests stay invisible to everyone but their owner + admin.
 *
 *  Names are resolved via the employee_names view (0007_employee_names_view.sql)
 *  rather than embedding profiles(full_name) directly - profiles' own RLS
 *  policy only lets a non-admin see their own row, so a direct embed would
 *  resolve every other employee's name to null for a non-admin viewer. */
export function useTeamPto(fromDateKey: string, toDateKey: string) {
  const [requests, setRequests] = useState<TeamPtoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [ptoRes, namesRes] = await Promise.all([
      supabase
        .from('pto_requests')
        .select('*')
        .eq('status', 'approved')
        .lte('start_date', toDateKey)
        .gte('end_date', fromDateKey),
      supabase.from('employee_names').select('id, full_name'),
    ]);

    if (ptoRes.error) {
      setError(ptoRes.error.message);
    } else {
      setError(null);
      const nameById = new Map((namesRes.data ?? []).map((n) => [n.id, n.full_name]));
      setRequests(
        ptoRes.data.map((r) => ({
          ...r,
          profiles: { full_name: nameById.get(r.employee_id) ?? 'Unknown' },
        })),
      );
    }
    setLoading(false);
  }, [fromDateKey, toDateKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { requests, loading, error, refresh };
}
