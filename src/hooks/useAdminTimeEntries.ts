import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
export type AdminTimeEntryRow = TimeEntry & { profiles: { full_name: string } | null };

export interface EntryFilters {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  employeeId: string | 'all';
}

export function defaultFilters(): EntryFilters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return {
    from: from.toLocaleDateString('en-CA'),
    to: to.toLocaleDateString('en-CA'),
    employeeId: 'all',
  };
}

/** Admin browse/edit view over all employees' time entries, with date + employee filters. */
export function useAdminTimeEntries(filters: EntryFilters) {
  const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('time_entries')
      .select('*, profiles!time_entries_employee_id_fkey(full_name)')
      .gte('clock_in', `${filters.from}T00:00:00`)
      .lte('clock_in', `${filters.to}T23:59:59`)
      .order('clock_in', { ascending: false });

    if (filters.employeeId !== 'all') query = query.eq('employee_id', filters.employeeId);

    const { data, error } = await query;
    if (error) setError(error.message);
    else {
      setError(null);
      setEntries((data ?? []) as unknown as AdminTimeEntryRow[]);
    }
    setLoading(false);
  }, [filters.from, filters.to, filters.employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
