import { useEffect, useRef, useState } from "react";
import { useBusinessUnitContext } from "../context/BusinessUnitContext";

// The Sidebar's "viewing as" control for a Head Office admin with more
// than one business unit. A plain <select> looked and behaved like a
// stray form field dropped into the middle of the nav — this instead
// matches the rest of the shell: a button styled like the sign-out /
// secondary buttons elsewhere in the Sidebar, opening a small menu
// built from the same rounded-lg nav-item treatment used for the links
// below it (active item picked out in brand-primary, same as an active
// NavLink).
export function BusinessUnitSwitcher() {
  const { units, viewingUnitId, setViewingUnitId } = useBusinessUnitContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = units.find((u) => u.id === viewingUnitId);
  const currentLabel = current ? current.company_name : "All units";

  function choose(id: string | null) {
    setViewingUnitId(id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative border-b border-line px-3 pb-3">
      <div className="mb-1.5 px-1 text-xs font-medium text-ink-muted">Viewing as</div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{currentLabel}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="listbox" className="card absolute inset-x-3 top-full z-20 mt-1 space-y-0.5 p-1.5 shadow-md">
          <SwitcherOption label="All units" selected={!viewingUnitId} onClick={() => choose(null)} />
          {units.map((u) => (
            <SwitcherOption
              key={u.id}
              label={u.company_name}
              tag={u.is_head_office ? "Head Office" : undefined}
              selected={viewingUnitId === u.id}
              onClick={() => choose(u.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SwitcherOption({
  label,
  tag,
  selected,
  onClick,
}: {
  label: string;
  tag?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        selected ? "bg-brand-primary/10 font-medium text-brand-primary" : "text-ink hover:bg-surface-muted"
      }`}
    >
      <span className="truncate">
        {label}
        {tag && <span className="ml-1.5 text-xs text-ink-muted">· {tag}</span>}
      </span>
      {selected && (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
          <path d="M4 10.5 8 14l8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
