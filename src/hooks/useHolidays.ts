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

  // update/remove both request the row back via .select() and check it was
  // actually returned - an UPDATE/DELETE that RLS blocks doesn't error, it
  // just matches zero rows (the USING clause filters them out before the
  // statement runs), so a bare .update()/.delete() with no .select() would
  // silently "succeed" while changing nothing. Caught live: editing a
  // holiday before the admin UPDATE policy existed reset the form as if it
  // worked, but the name never actually changed.
  async function update(id: string, name: string, holidayDate: string) {
    const { data, error } = await supabase
      .from('holidays')
      .update({ name, holiday_date: holidayDate })
      .eq('id', id)
      .select('id');
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "Couldn't save - you may not have permission to edit holidays." };
    await refresh();
    return { error: null };
  }

  async function remove(id: string) {
    const { data, error } = await supabase.from('holidays').delete().eq('id', id).select('id');
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "Couldn't remove - you may not have permission to edit holidays." };
    await refresh();
    return { error: null };
  }

  /** Inserts every {name, date} given, silently skipping any date that
   *  already has a holiday row (holiday_date is unique) rather than failing
   *  the whole batch - used by "Add Federal Holidays" so re-clicking it (or
   *  clicking it after someone already manually added one of the same
   *  dates) doesn't error. Returns how many were actually added. */
  async function bulkCreate(rows: { name: string; date: string }[]) {
    const { data, error } = await supabase
      .from('holidays')
      .upsert(
        rows.map((r) => ({ name: r.name, holiday_date: r.date })),
        { onConflict: 'holiday_date', ignoreDuplicates: true },
      )
      .select('id');
    if (error) return { added: 0, error: error.message };
    await refresh();
    return { added: data?.length ?? 0, error: null };
  }

  return { holidays, loading, error, refresh, create, update, remove, bulkCreate };
}
