import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getBestEffortLocation } from '../lib/geolocation';
import type { Database } from '../lib/database.types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];

/** Tracks the caller's currently-open (clocked-in) time entry, if any. */
export function useClockStatus(employeeId: string | undefined) {
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .is('clock_out', null)
      .maybeSingle();
    if (error) setError(error.message);
    else {
      setError(null);
      setOpenEntry(data);
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function clockIn() {
    if (!employeeId) return;
    setError(null);
    // Best-effort only - never blocks the clock-in on a slow/denied/missing
    // location (see getBestEffortLocation).
    const location = await getBestEffortLocation();
    const { error } = await supabase.from('time_entries').insert({
      employee_id: employeeId,
      clock_in: new Date().toISOString(),
      source: 'self',
      clock_in_lat: location?.lat ?? null,
      clock_in_lng: location?.lng ?? null,
      clock_in_accuracy_m: location?.accuracyM ?? null,
    });
    if (error) setError(error.message);
    else await refresh();
  }

  async function clockOut() {
    if (!openEntry) return;
    setError(null);
    const location = await getBestEffortLocation();
    const { error } = await supabase
      .from('time_entries')
      .update({
        clock_out: new Date().toISOString(),
        clock_out_lat: location?.lat ?? null,
        clock_out_lng: location?.lng ?? null,
        clock_out_accuracy_m: location?.accuracyM ?? null,
      })
      .eq('id', openEntry.id);
    if (error) setError(error.message);
    else await refresh();
  }

  return { openEntry, loading, error, clockIn, clockOut, refresh };
}
