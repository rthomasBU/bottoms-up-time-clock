import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

/** All employee profiles, for admin employee-pickers. */
export function useEmployees(includeInactive = false) {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (!includeInactive) query = query.eq('employment_status', 'active');
    const { data, error } = await query;
    if (error) setError(error.message);
    else {
      setError(null);
      setEmployees(data ?? []);
    }
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { employees, loading, error, refresh };
}
