import { supabase } from "./supabase";
import type { PersonType } from "./types";

// Shared pieces of the People onboarding flow (docs/ONBOARDING_DESIGN.md).

export const HEALTH_CONDITIONS = [
  { key: "epilepsy", label: "Epilepsy" },
  { key: "diabetes", label: "Diabetes" },
  { key: "heart", label: "Heart condition" },
  { key: "mental_health", label: "Mental health condition" },
  { key: "other", label: "Other condition" },
] as const;

export const CERT_KINDS: { key: string; label: string; forTypes?: PersonType[] }[] = [
  { key: "cscs", label: "CSCS card" },
  { key: "first_aid", label: "First aid" },
  { key: "ssts", label: "SSSTS" },
  { key: "smsts", label: "SMSTS" },
  { key: "working_at_height", label: "Working at height" },
  { key: "ipaf", label: "IPAF" },
  { key: "pasma", label: "PASMA" },
  { key: "asbestos_awareness", label: "Asbestos awareness" },
  { key: "manual_handling", label: "Manual handling" },
  { key: "public_liability", label: "Public liability insurance", forTypes: ["subcontractor"] },
  { key: "right_to_work", label: "Right to work" },
  { key: "other", label: "Other" },
];

export function certLabel(kind: string): string {
  return CERT_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

export interface CertEntry {
  id: string;
  kind: string;
  number: string;
  expiry: string;
  file_path: string;
  file_name: string;
}

export interface Draft {
  personal: {
    dob?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    town?: string;
    postcode?: string;
    county?: string;
  };
  tax: {
    ni_number?: string;
    utr?: string;
    bank_name?: string;
    account_number?: string;
    sort_code?: string;
    company_name?: string;
    company_number?: string;
    engagement_type?: string;
    starter_statement?: string;
    student_loan?: boolean;
  };
  safety: {
    site_work?: boolean | null;
    emergency: { name?: string; phone?: string; relationship?: string };
  };
  health: {
    consent?: boolean;
    conditions: Record<string, { on: boolean; controlled?: string; medication?: string }>;
    doctor: { name?: string; phone?: string; surgery?: string };
  };
  rtw: { file_path?: string; file_name?: string };
  certs: CertEntry[];
  agreed?: boolean;
  signed_pdf_path?: string;
}

export function emptyDraft(): Draft {
  return {
    personal: {},
    tax: {},
    safety: { site_work: null, emergency: {} },
    health: { conditions: {}, doctor: {} },
    rtw: {},
    certs: [],
  };
}

export function normaliseDraft(raw: unknown): Draft {
  const base = emptyDraft();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Draft>;
  return {
    personal: { ...base.personal, ...(r.personal ?? {}) },
    tax: { ...base.tax, ...(r.tax ?? {}) },
    safety: { ...base.safety, ...(r.safety ?? {}), emergency: { ...(r.safety?.emergency ?? {}) } },
    health: {
      ...base.health,
      ...(r.health ?? {}),
      conditions: { ...(r.health?.conditions ?? {}) },
      doctor: { ...(r.health?.doctor ?? {}) },
    },
    rtw: { ...(r.rtw ?? {}) },
    certs: Array.isArray(r.certs) ? r.certs : [],
    agreed: r.agreed === true,
    signed_pdf_path: typeof r.signed_pdf_path === "string" ? r.signed_pdf_path : undefined,
  };
}

// UK National Insurance number: two letters, six digits, A-D.
export function isValidNi(v: string): boolean {
  return /^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/.test(v.replace(/\s+/g, "").toUpperCase());
}

export function formatSortCode(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 6);
  return d.replace(/(\d{2})(?=\d)/g, "$1-");
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const ONBOARDING_BUCKET = "onboarding-docs";

// Uploads into a folder named after the onboarding id (an unguessable
// UUID). The storage policy only accepts uploads while that onboarding
// is open, and the bucket is private: only an admin can read it back.
export async function uploadOnboardingDoc(
  onboardingId: string,
  file: File
): Promise<{ path: string; name: string } | { error: string }> {
  if (file.size > 10 * 1024 * 1024) return { error: "That file is over 10MB." };
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${onboardingId}/${newId()}-${safe}`;
  const { error } = await supabase.storage.from(ONBOARDING_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path, name: file.name };
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/onboard/${token}`;
}

export const RATE_UNITS = [
  { key: "day", label: "per day" },
  { key: "hour", label: "per hour" },
  { key: "job", label: "per job" },
  { key: "year", label: "per year" },
] as const;

export const TRADES = ["Painter and Decorator", "Plumber", "Plasterer", "Electrician", "Carpenter"] as const;
