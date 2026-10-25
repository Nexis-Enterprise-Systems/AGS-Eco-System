import { PageHeader } from "../components/PageHeader";

// Suppliers: anyone AGS buys from (materials, services, agencies and
// sub-contractor businesses). Page shell only for now.
export function Suppliers() {
  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" subtitle="Materials, services, agencies and sub-contractor businesses." />

      <div className="card space-y-2 p-6">
        <p className="max-w-2xl text-sm text-ink-muted">
          One record per business: terms, rates and contacts. Agencies sit here, with their workers appearing on a job when
          you allocate them. Sub-contractor businesses sit here too, with their workers and compliance shown under People.
        </p>
        <p className="text-sm text-ink-muted">Coming soon. See the Roadmap for where this sits in the build.</p>
      </div>
    </div>
  );
}
