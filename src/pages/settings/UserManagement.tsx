import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { InvitedUsersPanel } from "../InvitedUsers";
import { TeamMembers } from "./TeamMembers";

const TABS = [
  { key: "invites", label: "Invites" },
  { key: "team", label: "Team Members" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// System Settings -> User Management — the page-level shell (back
// link, header, tabs). Invites (bulk-onboarding via email allowlist)
// and Team Members (who's visible in the Team directory) both live
// here since they're both "manage the people on this system", even
// though they touch different tables.
export function UserManagement() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("invites");

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Invite new people and control what colleagues can see about each other."
        back={{ label: "Back to Settings", onClick: () => navigate("/settings") }}
      />

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-brand-primary text-brand-primary"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "invites" ? <InvitedUsersPanel /> : <TeamMembers />}
    </div>
  );
}
