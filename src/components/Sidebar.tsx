import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";
import { BusinessUnitSwitcher } from "./BusinessUnitSwitcher";
import { BrandLogo } from "./BrandLogo";
import { ThemeToggle } from "./ThemeToggle";

// Invited Users moved under System Settings → User Management (same
// card pattern as Business Units/Integrations) — it's an admin setup
// task, not a daily-use page, so it no longer needs its own top-level
// slot. System Settings and Account & Security are both "manage
// things about me/this account" rather than day-to-day work, so they
// live together in the footer, just above the signed-in user's name —
// visually grouped, not merged: System Settings stays admin-only and
// Account & Security stays open to every role, each keeping its own
// existing route and permission gate.
const NAV_ITEMS = [
  { to: "/workspace", label: "My Workspace", roles: ["admin", "staff", "subcontractor"] },
  { to: "/", label: "Dashboard", roles: ["admin", "staff", "subcontractor"] },
  { to: "/clients", label: "Clients", roles: ["admin", "staff"] },
  { to: "/projects", label: "Projects", roles: ["admin", "staff", "subcontractor"] },
  { to: "/people", label: "People", roles: ["admin"] },
  { to: "/suppliers", label: "Suppliers", roles: ["admin"] },
  { to: "/team", label: "Team", roles: ["admin", "staff", "subcontractor"] },
] as const;

const FOOTER_NAV_ITEMS = [
  { to: "/roadmap", label: "Roadmap", roles: ["admin"] },
  { to: "/settings", label: "System Settings", roles: ["admin"] },
  { to: "/account", label: "Account & Security", roles: ["admin", "staff", "subcontractor"] },
] as const;

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { activeBranding, units, isHeadOfficeScoped } = useBusinessUnitContext();
  const role = profile?.role ?? "staff";
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const footerItems = FOOTER_NAV_ITEMS.filter((item) => item.roles.includes(role));
  // Only worth showing once there's more than one unit to switch
  // between — a single-entity client (the common case) never sees
  // this at all.
  const showSwitcher = isHeadOfficeScoped && units.length > 1;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface">
      {/* AGS brand block: the wordmark already carries "Decorating &
          Refurbishment", so the company name is not repeated beside it.
          The logo comes from System Settings -> Business Units -> Branding,
          falling back to the bundled public/ags-logo.png. */}
      <div className="border-b border-line px-5 pb-4 pt-6">
        <BrandLogo src={activeBranding?.logo_url} maxWidth={190} />
        <div className="mt-3 text-center text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">Eco System</div>
      </div>

      {showSwitcher && <BusinessUnitSwitcher />}

      <nav className="flex-1 space-y-1 px-3 pt-8">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-primary text-on-primary" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {footerItems.length > 0 && (
        <div className="space-y-1 border-t border-line px-3 py-3">
          {footerItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-primary text-on-primary" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      <div className="border-t border-line px-4 py-4">
        <NavLink
          to="/profile"
          className="mb-2 flex items-center gap-2 truncate rounded-lg -mx-1 px-1 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[10px] font-semibold text-brand-primary">
              {(profile?.full_name || profile?.email || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="truncate">
            {profile?.full_name || profile?.email}
            <span className="ml-1 capitalize">({role})</span>
          </span>
        </NavLink>
        <button className="btn-secondary w-full" onClick={() => signOut()}>
          Sign out
        </button>
        <div className="mt-3 text-center">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
