import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Integration } from "../lib/types";

// The catalogue of integrations offered in System Settings. This is
// deliberately honest about which providers are real live API
// integrations versus file-generation-only capabilities — see the
// integration_type note in supabase/migrations/0001_init.sql. Do not
// present a file_export provider as a live connection in the UI.
export const INTEGRATION_CATALOGUE: {
  provider: string;
  label: string;
  category: Integration["category"];
  integration_type: Integration["integration_type"];
  description: string;
  // True for a real API integration that isn't built yet — the OAuth
  // handshake, server-side token storage and sync logic. Never let the
  // UI's "Connect" button silently mark one of these as connected; it
  // would be lying about what actually happened. Use "Import CSV/Excel"
  // on the Clients page in the meantime — it recognises the default
  // export column headers from Xero, QuickBooks Online and Zoho Books.
  comingSoon?: boolean;
}[] = [
  {
    provider: "xero",
    label: "Xero",
    category: "accounting",
    integration_type: "api",
    description: "Sync invoices, bills and contacts via Xero's API.",
    comingSoon: true,
  },
  {
    provider: "quickbooks",
    label: "QuickBooks Online",
    category: "accounting",
    integration_type: "api",
    description: "Sync invoices, bills and contacts via the QuickBooks Online API.",
    comingSoon: true,
  },
  {
    provider: "zoho_books",
    label: "Zoho Books",
    category: "accounting",
    integration_type: "api",
    description: "Sync invoices, bills and contacts via the Zoho Books API.",
    comingSoon: true,
  },
  {
    provider: "google",
    label: "Google Workspace",
    category: "email",
    integration_type: "api",
    description: "Send and read email via the Gmail API (OAuth).",
  },
  {
    provider: "microsoft",
    label: "Microsoft 365",
    category: "email",
    integration_type: "api",
    description: "Send and read email via Microsoft Graph (OAuth).",
  },
  {
    provider: "wps",
    label: "UAE Wage Protection System (WPS)",
    category: "payroll",
    integration_type: "file_export",
    description:
      "There is no public WPS API. This generates a SIF file for upload through your bank, exchange house, or WPS agent portal — it does not submit payroll automatically.",
  },
  {
    provider: "bank_file_export",
    label: "Bulk Bank Payment File",
    category: "banking",
    integration_type: "file_export",
    description:
      "UAE Open Banking is not yet production-ready for third-party access. This generates a bulk payment file for upload to your bank's own portal — it is not a live banking connection.",
  },
];

export function useIntegrations() {
  const [rows, setRows] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("integrations").select("*");
    setRows((data as Integration[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Ensures a row exists for every catalogue entry (idempotent
  // upsert-by-provider) so the settings page always has something to
  // render, even on a freshly-migrated database.
  const ensureSeeded = useCallback(async () => {
    const existing = new Set(rows.map((r) => r.provider));
    const missing = INTEGRATION_CATALOGUE.filter((c) => !existing.has(c.provider));
    if (missing.length === 0) return;
    await supabase.from("integrations").upsert(
      missing.map((m) => ({
        provider: m.provider,
        category: m.category,
        integration_type: m.integration_type,
        status: "not_connected" as const,
      })),
      { onConflict: "provider" }
    );
    await refresh();
  }, [rows, refresh]);

  const setStatus = useCallback(
    async (provider: string, status: Integration["status"], config?: Record<string, unknown>) => {
      const { error } = await supabase
        .from("integrations")
        .update({
          status,
          config: config ?? {},
          connected_at: status === "connected" ? new Date().toISOString() : null,
        })
        .eq("provider", provider);
      if (!error) await refresh();
      return { error: error?.message ?? null };
    },
    [refresh]
  );

  return { rows, loading, refresh, ensureSeeded, setStatus };
}
