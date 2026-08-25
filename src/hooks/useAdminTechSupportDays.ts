import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';
import type { EntryFilters } from './useAdminTimeEntries';

type TechSupportDay = Database['public']['Tables']['tech_support_days']['Row'];
export type AdminTechSupportDayRow = TechSupportDay & { profiles: { full_name: string } | null };

/** Admin view over every employee's logged tech support days, reusing the
 *  same {from, to, employeeId} shape as useAdminTimeEntries/useAdminTravelDays
 *  so all three can share one set of pay-period/employee filters (see
 *  ExportPage). */
export function useAdminTechSupportDays(filters: EntryFilters) {
  const [techSupportDays, setTechSupportDays] = useState<AdminTechSupportDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('tech_support_days')
      .select('*, profiles!tech_support_days_employee_id_fkey(full_name)')
      .gte('support_date', filters.from)
      .lte('support_date', filters.to)
      .order('support_date', { ascending: false });

    if (filters.employeeId !== 'all') query = query.eq('employee_id', filters.employeeId);

    const { data, error } = await query;
    if (error) setError(error.message);
    else {
      setError(null);
      setTechSupportDays((data ?? []) as unknown as AdminTechSupportDayRow[]);
    }
    setLoading(false);
  }, [filters.from, filters.to, filters.employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { techSupportDays, loading, error, refresh };
}
