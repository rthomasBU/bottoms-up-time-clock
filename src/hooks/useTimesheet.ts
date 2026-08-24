import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];

const DEFAULT_LOOKBACK_DAYS = 60;

/** An employee's own time entries, most recent first. */
export function useTimesheet(employeeId: string | undefined, lookbackDays = DEFAULT_LOOKBACK_DAYS) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('clock_in', since.toISOString())
      .order('clock_in', { ascending: false });
    if (error) setError(error.message);
    else {
      setError(null);
      setEntries(data ?? []);
    }
    setLoading(false);
  }, [employeeId, lookbackDays]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
