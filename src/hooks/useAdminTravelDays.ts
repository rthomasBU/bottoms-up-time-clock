import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';
import type { EntryFilters } from './useAdminTimeEntries';

type TravelDay = Database['public']['Tables']['travel_days']['Row'];
export type AdminTravelDayRow = TravelDay & { profiles: { full_name: string } | null };

/** Admin view over every employee's logged per diem travel days, reusing
 *  the same {from, to, employeeId} shape as useAdminTimeEntries so both can
 *  share one set of date/employee filters (see ExportPage). */
export function useAdminTravelDays(filters: EntryFilters) {
  const [travelDays, setTravelDays] = useState<AdminTravelDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('travel_days')
      .select('*, profiles!travel_days_employee_id_fkey(full_name)')
      .gte('travel_date', filters.from)
      .lte('travel_date', filters.to)
      .order('travel_date', { ascending: false });

    if (filters.employeeId !== 'all') query = query.eq('employee_id', filters.employeeId);

    const { data, error } = await query;
    if (error) setError(error.message);
    else {
      setError(null);
      setTravelDays((data ?? []) as unknown as AdminTravelDayRow[]);
    }
    setLoading(false);
  }, [filters.from, filters.to, filters.employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { travelDays, loading, error, refresh };
}
