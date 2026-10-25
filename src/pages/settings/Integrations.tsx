import { useEffect } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useNavigate } from "react-router-dom";
import { INTEGRATION_CATALOGUE, useIntegrations } from "../../hooks/useIntegrations";

export function Integrations() {
  const navigate = useNavigate();
  const { rows: integrations, loading, ensureSeeded, setStatus } = useIntegrations();

  useEffect(() => {
    if (!loading) ensureSeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        back={{ label: "Back to Settings", onClick: () => navigate("/settings") }}
        subtitle={
          <>
          Live API connections are marked <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">API</span>. Providers
          marked <span className="badge bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">File export</span> generate a file for you to
          upload manually — they are not live connections, by design (UAE WPS and Open Banking have no public API for
          this yet).
          </>
        }
      />

      {["accounting", "email", "payroll", "banking"].map((category) => {
        const items = INTEGRATION_CATALOGUE.filter((c) => c.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="card p-6">
            <h3 className="mb-3 text-sm font-semibold capitalize">{category}</h3>
            <div className="space-y-3">
              {items.map((item) => {
                const row = integrations.find((r) => r.provider === item.provider);
                const connected = row?.status === "connected";
                return (
                  <div
                    key={item.provider}
                    className="flex items-start justify-between gap-4 rounded-lg border border-line p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        <span
                          className={`badge ${
                            item.integration_type === "api" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {item.integration_type === "api" ? "API" : "File export"}
                        </span>
                        {connected && <span className="badge bg-brand-primary/10 text-brand-primary">Connected</span>}
                        {item.comingSoon && <span className="badge bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">Coming soon</span>}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {item.comingSoon
                          ? `${item.description} Not built yet — use Clients → Import CSV/Excel with an export from ${item.label} in the meantime.`
                          : item.description}
                      </p>
                    </div>
                    <button
                      className={connected ? "btn-secondary shrink-0" : "btn-primary shrink-0"}
                      disabled={item.comingSoon}
                      title={item.comingSoon ? "Live connect isn't built yet — use CSV/Excel import instead." : undefined}
                      onClick={() => setStatus(item.provider, connected ? "not_connected" : "connected")}
                    >
                      {item.comingSoon ? "Coming soon" : connected ? "Disconnect" : item.integration_type === "api" ? "Connect" : "Enable"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
