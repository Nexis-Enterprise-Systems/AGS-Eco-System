import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Generic CRUD hook over a single Supabase table. This is the shared
// engine behind Clients, Projects and Sub-Contractors so each of those
// pages only has to describe its columns and forms, not re-implement
// fetch/create/update/delete/error-handling three times.
export function useTable<T extends { id: string }>(
  table: string,
  options?: { orderBy?: string; ascending?: boolean; filter?: (query: any) => any }
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase.from(table).select("*");
    if (options?.filter) query = options.filter(query);
    if (options?.orderBy) query = query.order(options.orderBy, { ascending: options?.ascending ?? false });
    const { data, error: err } = await query;
    if (err) setError(err.message);
    setRows((data as T[]) ?? []);
    setLoading(false);
  }, [table, options?.orderBy, options?.ascending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (values: Partial<T>) => {
      const { data, error: err } = await supabase.from(table).insert(values).select().single();
      if (err) return { error: err.message, data: null };
      await refresh();
      return { error: null, data: data as T };
    },
    [table, refresh]
  );

  const createMany = useCallback(
    async (values: Partial<T>[]) => {
      if (values.length === 0) return { error: null, count: 0 };
      const { error: err } = await supabase.from(table).insert(values);
      if (err) return { error: err.message, count: 0 };
      await refresh();
      return { error: null, count: values.length };
    },
    [table, refresh]
  );

  const update = useCallback(
    async (id: string, values: Partial<T>) => {
      const { error: err } = await supabase.from(table).update(values).eq("id", id);
      if (err) return { error: err.message };
      await refresh();
      return { error: null };
    },
    [table, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: err } = await supabase.from(table).delete().eq("id", id);
      if (err) return { error: err.message };
      await refresh();
      return { error: null };
    },
    [table, refresh]
  );

  return { rows, loading, error, refresh, create, createMany, update, remove };
}
