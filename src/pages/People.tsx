import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { PeopleList } from "./PeopleList";
import { CompliancePanel } from "../components/CompliancePanel";

// People: employees and sub-contractors in one area, kept strictly apart
// inside (see docs/PEOPLE_DESIGN.md). Everyone joins through the same
// onboarding process (docs/ONBOARDING_DESIGN.md). Agencies are held
// under Suppliers.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "employees", label: "Employees" },
  { key: "subcontractors", label: "Sub-contractors" },
  { key: "compliance", label: "Compliance" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function People() {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-6">
      <PageHeader title="People" subtitle="Employees and sub-contractors." />

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-b-2 border-brand-primary text-brand-primary" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <PeopleList />}
      {tab === "employees" && <PeopleList type="employee" />}
      {tab === "subcontractors" && <PeopleList type="subcontractor" />}
      {tab === "compliance" && <CompliancePanel />}
    </div>
  );
}
