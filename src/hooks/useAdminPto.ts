import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type PtoRequest = Database['public']['Tables']['pto_requests']['Row'];
export type AdminPtoRow = PtoRequest & { profiles: { full_name: string } | null };

/** Admin view of all PTO requests, defaulting to pending, with approve/deny. */
export function useAdminPto(statusFilter: 'pending' | 'all' = 'pending') {
  const [requests, setRequests] = useState<AdminPtoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('pto_requests')
      .select('*, profiles!pto_requests_employee_id_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (statusFilter === 'pending') query = query.eq('status', 'pending');
    const { data, error } = await query;
    if (error) setError(error.message);
    else {
      setError(null);
      setRequests((data ?? []) as unknown as AdminPtoRow[]);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function review(requestId: string, approve: boolean, notes?: string) {
    const { error } = await supabase.rpc('review_pto_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_notes: notes ?? null,
    });
    if (error) return { error: error.message };
    await refresh();
    return { error: null };
  }

  return { requests, loading, error, refresh, review };
}
