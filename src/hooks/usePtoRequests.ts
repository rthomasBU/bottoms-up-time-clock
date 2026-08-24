import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type PtoRequest = Database['public']['Tables']['pto_requests']['Row'];
type PtoType = Database['public']['Tables']['pto_requests']['Row']['pto_type'];

/** An employee's own PTO requests, most recent first. */
export function usePtoRequests(employeeId: string | undefined) {
  const [requests, setRequests] = useState<PtoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('pto_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else {
      setError(null);
      setRequests(data ?? []);
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit(input: { ptoType: PtoType; startDate: string; endDate: string; hours: number }) {
    if (!employeeId) return { error: 'Not signed in' };
    const { error } = await supabase.from('pto_requests').insert({
      employee_id: employeeId,
      pto_type: input.ptoType,
      start_date: input.startDate,
      end_date: input.endDate,
      hours_requested: input.hours,
    });
    if (error) return { error: error.message };
    await refresh();
    return { error: null };
  }

  async function cancel(id: string) {
    const { error } = await supabase.from('pto_requests').delete().eq('id', id);
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }

  return { requests, loading, error, refresh, submit, cancel };
}
