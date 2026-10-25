import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { applyCompanyIdentity, applyTheme } from "../lib/theme";
import type { SystemSettings } from "../lib/types";

// system_settings is a singleton row (id = true). This hook loads it,
// applies branding as CSS variables immediately, and exposes a save()
// for the System Settings page — saving re-applies the theme live, no
// reload needed.
export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from("system_settings").select("*").eq("id", true).single();
    if (err) setError(err.message);
    const row = (data as SystemSettings) ?? null;
    setSettings(row);
    applyTheme(row);
    applyCompanyIdentity(row?.company_name, row?.logo_url);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (values: Partial<SystemSettings>) => {
      const { data, error: err } = await supabase
        .from("system_settings")
        .update(values)
        .eq("id", true)
        .select()
        .single();
      if (err) return { error: err.message };
      const row = (data as SystemSettings) ?? null;
      setSettings(row);
      applyTheme(row);
      applyCompanyIdentity(row?.company_name, row?.logo_url);
      return { error: null };
    },
    []
  );

  return { settings, loading, error, refresh, save };
}
