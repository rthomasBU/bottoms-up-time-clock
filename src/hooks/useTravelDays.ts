import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type TravelDay = Database['public']['Tables']['travel_days']['Row'];

const LOOKBACK_DAYS = 60;

/** An employee's own logged per diem travel days, most recent first. */
export function useTravelDays(employeeId: string | undefined) {
  const [travelDays, setTravelDays] = useState<TravelDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const { data, error } = await supabase
      .from('travel_days')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('travel_date', since.toLocaleDateString('en-CA'))
      .order('travel_date', { ascending: false });
    if (error) setError(error.message);
    else {
      setError(null);
      setTravelDays(data ?? []);
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function logTravelDay(employeeId: string, travelDate: string, notes: string) {
    const { error } = await supabase.from('travel_days').insert({
      employee_id: employeeId,
      travel_date: travelDate,
      notes: notes.trim() || null,
      source: 'self',
      logged_by: employeeId,
    });
    if (error) throw new Error(error.code === '23505' ? 'You already logged a travel day for that date.' : error.message);
    await refresh();
  }

  async function deleteTravelDay(id: string) {
    const { error } = await supabase.from('travel_days').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await refresh();
  }

  return { travelDays, loading, error, refresh, logTravelDay, deleteTravelDay };
}
