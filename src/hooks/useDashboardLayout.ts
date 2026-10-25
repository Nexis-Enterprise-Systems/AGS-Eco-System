import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { UserRole } from "../lib/types";
import { defaultLayout, sanitiseLayout, type LayoutItem } from "../dashboard/registry";

// Loads and saves one person's dashboard layout. Saved to the database
// (table dashboard_layouts, migration 0009). If that table isn't there
// yet, or the save fails, it quietly falls back to this browser's local
// storage so the dashboard still works; `storedIn` says which is in use.
export function useDashboardLayout(userId: string | undefined, role: UserRole) {
  const [layout, setLayout] = useState<LayoutItem[]>(() => defaultLayout(role));
  const [loading, setLoading] = useState(true);
  const [storedIn, setStoredIn] = useState<"database" | "browser">("database");
  const localKey = userId ? `ags-dashboard-layout-${userId}` : "";

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.from("dashboard_layouts").select("layout").eq("user_id", userId).maybeSingle();
      if (!active) return;
      if (error) {
        setStoredIn("browser");
        try {
          const raw = localStorage.getItem(localKey);
          setLayout(raw ? sanitiseLayout(JSON.parse(raw), role) : defaultLayout(role));
        } catch {
          setLayout(defaultLayout(role));
        }
      } else {
        setStoredIn("database");
        setLayout(data ? sanitiseLayout((data as { layout: unknown }).layout, role) : defaultLayout(role));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId, role, localKey]);

  const save = useCallback(
    async (next: LayoutItem[]): Promise<{ error: string | null }> => {
      if (!userId) return { error: "Not signed in." };
      const clean = sanitiseLayout(next, role);
      const { error } = await supabase
        .from("dashboard_layouts")
        .upsert({ user_id: userId, layout: clean, updated_at: new Date().toISOString() });
      if (error) {
        setStoredIn("browser");
        try {
          localStorage.setItem(localKey, JSON.stringify(clean));
        } catch {
          /* storage blocked */
        }
        setLayout(clean);
        return { error: null };
      }
      setStoredIn("database");
      setLayout(clean);
      return { error: null };
    },
    [userId, role, localKey],
  );

  const reset = useCallback(async () => save(defaultLayout(role)), [save, role]);

  return { layout, loading, storedIn, save, reset };
}
