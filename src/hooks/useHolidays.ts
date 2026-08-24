import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type Holiday = Database['public']['Tables']['holidays']['Row'];

/** All company holidays (small table, no pagination needed at this scale). */
export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('holidays').select('*').order('holiday_date', { ascending: true });
    if (error) setError(error.message);
    else {
      setError(null);
      setHolidays(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create(name: string, holidayDate: string) {
    const { error } = await supabase.from('holidays').insert({ name, holiday_date: holidayDate });
    if (error) return { error: error.message };
    await refresh();
    return { error: null };
  }

  async function remove(id: string) {
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) return { error: error.message };
    await refresh();
    return { error: null };
  }

  return { holidays, loading, error, refresh, create, remove };
}
