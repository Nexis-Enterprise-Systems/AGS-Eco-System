import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BusinessUnitProvider } from "../context/BusinessUnitContext";
import { PageHeaderSlotContext } from "./PageHeader";

// Content area = a header slot pinned at the top (filled by each page's
// <PageHeader />, full width, thin rule underneath) and a scrolling body
// below it. Content is left-aligned, not centred.
export function Layout() {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  return (
    <BusinessUnitProvider>
      <PageHeaderSlotContext.Provider value={headerSlot}>
        <div className="flex h-screen w-screen overflow-hidden bg-surface-muted">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col">
            <div ref={setHeaderSlot} className="shrink-0 empty:hidden" />
            <div className="flex-1 overflow-y-auto">
              <div className="px-8 py-6">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </PageHeaderSlotContext.Provider>
    </BusinessUnitProvider>
  );
}
