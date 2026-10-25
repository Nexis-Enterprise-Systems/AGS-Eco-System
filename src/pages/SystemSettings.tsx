import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";

// System Settings landing page — a card per section. Company Profile
// and Company Branding used to be their own cards here, each editing
// the single system_settings row; both are now folded into Business
// Units (every client has at least a Head Office unit, so "Business
// Units" covers the single-entity case exactly as well as the
// multi-entity one — see MULTI_ENTITY_SPEC.md). Integrations stays
// separate since it's a growing list as more providers get built.
const SETTINGS_CARDS = [
  {
    to: "/settings/business-units",
    title: "Business Units",
    description: "Company profile, branding, registration and VAT details — per unit, starting with Head Office.",
  },
  {
    to: "/settings/user-management",
    title: "User Management",
    description: "Invite staff and sub-contractors, and control who's visible with their contact details in the Team directory.",
  },
  {
    to: "/settings/people-hr",
    title: "People & HR",
    description: "Job roles and contract templates, including the Managing Director's service agreement.",
  },
  {
    to: "/settings/integrations",
    title: "Integrations",
    description: "Accounting software, email and other connected providers.",
  },
] as const;

export function SettingsHome() {
  const navigate = useNavigate();
  const { headOffice, loading } = useBusinessUnitContext();

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" subtitle="Business units, branding and integrations for this client." />

      {loading ? (
        <div className="text-sm text-ink-muted">Loading…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SETTINGS_CARDS.map((card) => (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              className="card flex flex-col items-start gap-2 p-6 text-left transition-shadow hover:shadow-md"
            >
              <h2 className="text-sm font-semibold">{card.title}</h2>
              <p className="text-sm text-ink-muted">{card.description}</p>
              {card.to === "/settings/business-units" && headOffice && (
                <p className="mt-1 text-xs text-ink-muted">{headOffice.company_name}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
