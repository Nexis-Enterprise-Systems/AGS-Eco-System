import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Every page's title bar. It renders into a fixed slot at the top of the
// content area (see Layout.tsx), so the title is always left-aligned, the
// thin rule underneath runs the full width of the page, and the bar stays
// put while the page below it scrolls.
export const PageHeaderSlotContext = createContext<HTMLElement | null>(null);

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  back?: { label: string; onClick: () => void };
}

export function PageHeader({ title, subtitle, badge, actions, back }: PageHeaderProps) {
  const slot = useContext(PageHeaderSlotContext);
  if (!slot) return null;

  return createPortal(
    <header className="border-b border-line bg-surface px-8 py-5">
      {back && (
        <button className="mb-2 text-sm text-ink-muted hover:text-ink hover:underline" onClick={back.onClick}>
          ← {back.label}
        </button>
      )}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-medium leading-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>,
    slot,
  );
}
