"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Button } from "@/app/components/design-system/Button";

const PanelContext = createContext<{ open: boolean; panelId: string; label: string; toggle: () => void } | null>(null);

export function ConversationPanelToggle() {
  const panel = useContext(PanelContext);
  if (!panel) return null;
  return <Button variant="secondary" size="sm" aria-expanded={panel.open} aria-controls={panel.panelId} onClick={panel.toggle}>
    {`${panel.open ? "Skjul" : "Vis"} ${panel.label}`}
  </Button>;
}

/** Presentation only: collapsing the panel preserves conversation and report state. */
export function ConversationLayout({ children, sidebar, label }: {
  children: ReactNode;
  sidebar: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(true);
  const panelId = useId();

  return <PanelContext.Provider value={{ open, panelId, label, toggle: () => setOpen(!open) }}>
    <div className={`grid items-start ${open ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
      {children}
      <div id={panelId} hidden={!open} className="min-w-0 self-stretch border-t border-snake-border-on-dark-default bg-snake-app-deep lg:border-l lg:border-t-0">
        {sidebar}
      </div>
    </div>
  </PanelContext.Provider>;
}
