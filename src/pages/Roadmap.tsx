import { PageHeader } from "../components/PageHeader";
import data from "../roadmap/modules.json";

// What is built, what is in progress and what is planned. Driven by one
// file, src/roadmap/modules.json, so updating a module's status is a
// one-line change. docs/ROADMAP.md is generated from the same file.
type Status = "built" | "in_progress" | "planned";
interface Module {
  id: string;
  name: string;
  status: string;
  summary: string;
  dependsOn?: string[];
}

const STATUS: Record<Status, { label: string; badge: string }> = {
  built: { label: "Built", badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  in_progress: { label: "In progress", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  planned: { label: "Planned", badge: "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300" },
};

export function Roadmap() {
  const groups = data.groups as { id: string; name: string; description: string; modules: Module[] }[];
  const all = groups.flatMap((g) => g.modules);
  const names = Object.fromEntries(all.map((m) => [m.id, m.name]));
  const count = (s: Status) => all.filter((m) => m.status === s).length;
  const builtPct = Math.round((count("built") / all.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roadmap"
        subtitle={`What has been built and what is still to come. Last updated ${data.updated}.`}
      />

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <Stat label="Built" value={count("built")} />
          <Stat label="In progress" value={count("in_progress")} />
          <Stat label="Planned" value={count("planned")} />
          <Stat label="Total modules" value={all.length} />
        </div>
        <div
          className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={builtPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Share of modules built"
        >
          <div className="h-full bg-brand-accent" style={{ width: `${builtPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-ink-muted">{builtPct}% of modules built</div>
      </section>

      {groups.map((g) => (
        <section key={g.id} className="space-y-2">
          <div>
            <h2 className="text-lg font-medium">{g.name}</h2>
            <p className="text-sm text-ink-muted">{g.description}</p>
          </div>
          <div className="card divide-y divide-line">
            {g.modules.map((m) => {
              const st = STATUS[(m.status as Status) in STATUS ? (m.status as Status) : "planned"];
              return (
                <div key={m.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-sm text-ink-muted">{m.summary}</div>
                    {m.dependsOn && m.dependsOn.length > 0 && (
                      <div className="mt-1 text-xs text-ink-muted">
                        Depends on: {m.dependsOn.map((d) => names[d] ?? d).join(", ")}
                      </div>
                    )}
                  </div>
                  <span className={`badge shrink-0 self-start ${st.badge}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-medium">{value}</div>
      <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}
