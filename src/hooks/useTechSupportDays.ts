import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toDateKey } from '../lib/payroll';
import type { Database } from '../lib/database.types';

type TechSupportDay = Database['public']['Tables']['tech_support_days']['Row'];

/** Every yyyy-mm-dd date from `startKey` through `endKey`, inclusive. */
function dateRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  while (cursor <= end) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

const LOOKBACK_DAYS = 60;

/** An employee's own logged tech support days, most recent first - same
 *  shape as useTravelDays. */
export function useTechSupportDays(employeeId: string | undefined) {
  const [techSupportDays, setTechSupportDays] = useState<TechSupportDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const { data, error } = await supabase
      .from('tech_support_days')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('support_date', since.toLocaleDateString('en-CA'))
      .order('support_date', { ascending: false });
    if (error) setError(error.message);
    else {
      setError(null);
      setTechSupportDays(data ?? []);
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Logs every date from startDate through endDate (inclusive) in one go.
   *  Uses upsert + ignoreDuplicates rather than a plain insert so a date
   *  that's already logged is silently skipped instead of failing the
   *  whole range - the unique(employee_id, support_date) constraint still
   *  applies, this just turns "one bad date aborts everything" into
   *  "skip what's already there, log the rest". Returns how many of the
   *  requested dates were newly logged vs already existed. */
  async function logTechSupportDays(employeeId: string, startDate: string, endDate: string, notes: string) {
    const dates = dateRange(startDate, endDate);
    const rows = dates.map((support_date) => ({
      employee_id: employeeId,
      support_date,
      notes: notes.trim() || null,
      source: 'self' as const,
      logged_by: employeeId,
    }));
    const { data, error } = await supabase
      .from('tech_support_days')
      .upsert(rows, { onConflict: 'employee_id,support_date', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(error.message);
    await refresh();
    const logged = data?.length ?? 0;
    return { logged, skipped: dates.length - logged };
  }

  async function deleteTechSupportDay(id: string) {
    const { error } = await supabase.from('tech_support_days').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await refresh();
  }

  return { techSupportDays, loading, error, refresh, logTechSupportDays, deleteTechSupportDay };
}
