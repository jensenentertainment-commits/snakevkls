"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BorreWorkspace } from "@/app/borre/BorreWorkspace";

const enabledRoutes = ["/lager", "/products", "/locations", "/issues", "/location-count", "/activities", "/snakeboard", "/viper"];

export function BorreFloatingChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }
  if (!enabledRoutes.some(route => pathname.startsWith(route))) return null;
  return <>
    <button ref={trigger} type="button" hidden={open} aria-expanded={open} aria-controls="borre-floating-chat" onClick={() => { setOpen(true); requestAnimationFrame(() => closeButton.current?.focus()); }} className="fixed bottom-4 right-4 z-50 rounded-snake-action border border-snake-border-on-dark-strong bg-[#345C45] px-4 py-3 text-sm font-semibold text-snake-text-on-dark shadow-lg focus-visible:outline-2 focus-visible:outline-snake-focus-on-dark print:hidden">Børre</button>
    <div hidden={!open} id="borre-floating-chat" role="dialog" aria-modal="false" aria-label="Børre – Lageransvarlig" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }} className="fixed bottom-3 right-3 z-50 h-[min(600px,75dvh)] w-[390px] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-snake-card border border-snake-border-on-dark-strong bg-snake-app-elevated text-snake-text-on-dark shadow-2xl print:hidden">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-snake-border-on-dark-default bg-snake-hero px-4 py-3">
          <div><h2 className="font-semibold">Børre</h2><p className="text-xs text-snake-text-on-dark-muted">Lageransvarlig</p></div>
          <button ref={closeButton} type="button" onClick={close} aria-label="Lukk Børre-chat" className="min-h-11 rounded-snake-control px-3 text-sm hover:bg-snake-app-elevated focus-visible:outline-2 focus-visible:outline-snake-focus-on-dark">Lukk</button>
        </header>
        <div className="min-h-0 flex-1"><BorreWorkspace compact page={pathname} /></div>
      </div>
    </div>
  </>;
}
