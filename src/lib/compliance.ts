import { supabase } from "./supabase";

// A person's current certificate of one kind (the latest expiry wins, so a
// renewal replaces the old one). Comes from the compliance_current view.
export interface ComplianceItem {
  certificate_id: string;
  person_id: string;
  full_name: string;
  email: string;
  person_type: "employee" | "subcontractor";
  kind: string;
  number: string;
  expiry_date: string;
  file_path: string | null;
  days_left: number;
}

export async function loadCompliance(): Promise<{ items: ComplianceItem[]; error?: string }> {
  const { data, error } = await supabase.from("compliance_current").select("*").order("expiry_date");
  if (error) return { items: [], error: error.message };
  return { items: (data ?? []) as ComplianceItem[] };
}

export type ExpiryBand = "expired" | "30" | "60" | "ok";

export function expiryBand(days: number): ExpiryBand {
  if (days < 0) return "expired";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  return "ok";
}

export function daysText(days: number): string {
  if (days < 0) return `Expired ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
