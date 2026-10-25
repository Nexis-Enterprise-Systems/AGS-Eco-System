// Hand-written types matching supabase/migrations/0001_init.sql.
// If you have the Supabase CLI, you can replace this file by running:
//   supabase gen types typescript --project-id <ref> > src/lib/types.ts
// (then re-export the domain aliases below from the generated file).

export type UserRole = "admin" | "staff" | "subcontractor";
export type ClientStatus = "prospect" | "active" | "paused" | "archived";
export type ProjectStage =
  | "discovery"
  | "audit"
  | "proposal"
  | "agreement"
  | "build"
  | "rollout"
  | "retainer"
  | "complete"
  | "on_hold";
export type IntegrationCategory = "accounting" | "email" | "payroll" | "banking";
export type IntegrationStatus = "not_connected" | "connected" | "error";
export type IntegrationType = "api" | "file_export";
export type AuditDocType = "audit_export" | "findings" | "proposal" | "agreement" | "other";
export type Region = "gb" | "ae" | "other";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  // Admin-controlled, off by default. When true, this person's email
  // and phone appear in the team directory (get_team_directory) to
  // every signed-in user, not just admin/staff — see
  // supabase/migrations/0007_user_profiles.sql.
  show_contact_details: boolean;
  // null = access to all business units (Head Office admin/exec).
  // Non-null scopes this person to that one unit only, whatever their
  // role. See MULTI_ENTITY_SPEC.md.
  business_unit_id: string | null;
  created_at: string;
  updated_at: string;
}

// One row from get_team_directory() — the masked, cross-unit "who's
// who" every signed-in person can read. email/phone are null unless
// that person has switched show_contact_details on. See
// supabase/migrations/0007_user_profiles.sql.
export interface TeamDirectoryEntry {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  business_unit_id: string | null;
  email: string | null;
  phone: string | null;
}

// See MULTI_ENTITY_SPEC.md for the full design. is_head_office is true
// for exactly one row — its branding is the fallback for every other
// unit (when that unit's use_custom_branding is false) and what the
// login screen shows before anyone's identified themselves.
export interface BusinessUnit {
  id: string;
  is_head_office: boolean;
  company_name: string;
  trading_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  region: Region;
  business_registration_number: string | null;
  vat_number: string | null;
  use_custom_branding: boolean;
  // Per-unit toggle for whether this unit's people can upload a
  // profile photo. On by default. See
  // supabase/migrations/0007_user_profiles.sql.
  allow_profile_photos: boolean;
  logo_url: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_surface: string;
  color_surface_muted: string;
  color_ink: string;
  color_ink_muted: string;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  id: true;
  company_name: string;
  logo_url: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_surface: string;
  color_surface_muted: string;
  color_ink: string;
  color_ink_muted: string;
  contact_email: string | null;
  contact_phone: string | null;
  trading_name: string | null;
  address: string | null;
  region: Region;
  business_registration_number: string | null;
  vat_number: string | null;
  timezone: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  provider: string;
  category: IntegrationCategory;
  integration_type: IntegrationType;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  connected_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  trading_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: ClientStatus;
  notes: string | null;
  // Which business unit this client belongs to. Not null — every
  // client has exactly one owning unit. See MULTI_ENTITY_SPEC.md.
  business_unit_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  stage: ProjectStage;
  start_date: string | null;
  target_end_date: string | null;
  build_fee: number | null;
  monthly_retainer: number | null;
  currency: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubContractor {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  status: "active" | "inactive";
  notes: string | null;
  // Which business unit engaged this sub-contractor. Not null. See
  // MULTI_ENTITY_SPEC.md.
  business_unit_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectSubContractor {
  project_id: string;
  sub_contractor_id: string;
  role_on_project: string | null;
  assigned_at: string;
}

export interface AuditDocument {
  id: string;
  project_id: string;
  file_name: string;
  storage_path: string;
  doc_type: AuditDocType;
  notes: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface InvitedUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  // Which business unit this invite lands the new account in — null
  // means "all units" (a Head Office-level invite). Copied onto the
  // new profiles row by handle_new_user() when the invite is accepted.
  business_unit_id: string | null;
  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;
}

// Minimal shape satisfying @supabase/supabase-js's generic Database
// param. Table row/insert/update all share the same shape here for
// simplicity — adjust if you generate real types later.
export interface DashboardLayoutRow {
  user_id: string;
  layout: { id: string; size: number }[];
  updated_at: string;
}

export interface JobRoleRow {
  id: string;
  title: string;
  summary: string;
  duties: string;
  reports_to: string;
  place_of_work: string;
  typical_hours: string;
  status: "draft" | "active" | "retired";
  created_at: string;
  updated_at: string;
}

export type ContractTemplateStatus = "draft" | "solicitor_review" | "approved" | "retired";

export interface ContractTemplateRow {
  id: string;
  key: string;
  name: string;
  employee_type: "director" | "permanent" | "part_time" | "fixed_term" | "apprentice" | "casual" | "subcontractor";
  version: number;
  status: ContractTemplateStatus;
  body_md: string;
  notes_md: string;
  fields: { key: string; label: string }[];
  reviewed_by: string | null;
  reviewed_on: string | null;
  created_at: string;
  updated_at: string;
}

export type PersonType = "employee" | "subcontractor";
export type PersonStatus = "pending" | "active" | "rejected" | "archived";
export type OnboardingStatus = "invited" | "in_progress" | "signed" | "accepted" | "rejected" | "expired";

export interface PersonRow {
  id: string;
  person_type: PersonType;
  full_name: string;
  email: string;
  phone: string;
  status: PersonStatus;
  job_role_id: string | null;
  job_title: string;
  start_date: string | null;
  rate: number | null;
  rate_unit: "year" | "day" | "hour" | "job" | null;
  engagement_type: "individual" | "limited_company" | null;
  notes: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingRow {
  id: string;
  person_id: string;
  status: OnboardingStatus;
  token_expires_at: string | null;
  template_id: string | null;
  step: number;
  invited_at: string;
  signed_at: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface PersonPrivateRow {
  person_id: string;
  date_of_birth: string | null;
  address: string;
  address_line1: string;
  address_line2: string;
  town: string;
  county: string;
  postcode: string;
  ni_number: string;
  utr: string;
  bank_name: string;
  account_number: string;
  sort_code: string;
  company_name: string;
  company_number: string;
  starter_statement: string;
  student_loan: boolean;
  emergency_name: string;
  emergency_phone: string;
  emergency_relationship: string;
  updated_at: string;
}

export interface PersonHealthRow {
  person_id: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export interface PersonCertificateRow {
  id: string;
  person_id: string;
  kind: string;
  number: string;
  expiry_date: string | null;
  file_path: string | null;
  source: string;
  created_at: string;
}

export interface SignedAgreementRow {
  id: string;
  person_id: string;
  onboarding_id: string | null;
  template_name: string;
  template_version: number | null;
  body_text: string;
  signature_name: string;
  signed_at: string;
  pdf_path: string | null;
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      system_settings: { Row: SystemSettings; Insert: Partial<SystemSettings>; Update: Partial<SystemSettings> };
      business_units: { Row: BusinessUnit; Insert: Partial<BusinessUnit>; Update: Partial<BusinessUnit> };
      integrations: { Row: Integration; Insert: Partial<Integration>; Update: Partial<Integration> };
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client> };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> };
      sub_contractors: { Row: SubContractor; Insert: Partial<SubContractor>; Update: Partial<SubContractor> };
      project_subcontractors: {
        Row: ProjectSubContractor;
        Insert: Partial<ProjectSubContractor>;
        Update: Partial<ProjectSubContractor>;
      };
      audit_documents: { Row: AuditDocument; Insert: Partial<AuditDocument>; Update: Partial<AuditDocument> };
      invited_users: { Row: InvitedUser; Insert: Partial<InvitedUser>; Update: Partial<InvitedUser> };
      job_roles: { Row: JobRoleRow; Insert: Partial<JobRoleRow>; Update: Partial<JobRoleRow> };
      contract_templates: {
        Row: ContractTemplateRow;
        Insert: Partial<ContractTemplateRow>;
        Update: Partial<ContractTemplateRow>;
      };
      people: { Row: PersonRow; Insert: Partial<PersonRow>; Update: Partial<PersonRow> };
      onboardings: { Row: OnboardingRow; Insert: Partial<OnboardingRow>; Update: Partial<OnboardingRow> };
      person_private: { Row: PersonPrivateRow; Insert: Partial<PersonPrivateRow>; Update: Partial<PersonPrivateRow> };
      person_health: { Row: PersonHealthRow; Insert: Partial<PersonHealthRow>; Update: Partial<PersonHealthRow> };
      person_certificates: {
        Row: PersonCertificateRow;
        Insert: Partial<PersonCertificateRow>;
        Update: Partial<PersonCertificateRow>;
      };
      signed_agreements: {
        Row: SignedAgreementRow;
        Insert: Partial<SignedAgreementRow>;
        Update: Partial<SignedAgreementRow>;
      };
      dashboard_layouts: {
        Row: DashboardLayoutRow;
        Insert: Partial<DashboardLayoutRow>;
        Update: Partial<DashboardLayoutRow>;
      };
    };
    Functions: {
      onboarding_create: {
        Args: {
          p_type: string;
          p_full_name: string;
          p_email: string;
          p_phone: string;
          p_job_role_id: string | null;
          p_job_title: string;
          p_start_date: string | null;
          p_rate: number | null;
          p_rate_unit: string | null;
          p_engagement_type: string | null;
          p_template_id: string | null;
        };
        Returns: { person_id: string; onboarding_id: string; token: string };
      };
      onboarding_reissue: { Args: { p_onboarding_id: string }; Returns: string };
      onboarding_review: {
        Args: { p_onboarding_id: string; p_accept: boolean; p_reason?: string | null };
        Returns: unknown;
      };
      onboarding_get: { Args: { p_token: string }; Returns: Record<string, unknown> };
      onboarding_save: { Args: { p_token: string; p_draft: unknown; p_step: number }; Returns: Record<string, unknown> };
      onboarding_sign: { Args: { p_token: string; p_signature: string }; Returns: Record<string, unknown> };
      check_invite: {
        Args: { p_email: string };
        Returns: { full_name: string }[];
      };
      get_team_directory: {
        Args: Record<string, never>;
        Returns: TeamDirectoryEntry[];
      };
    };
  };
};
