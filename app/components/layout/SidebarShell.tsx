"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, UserRound, X } from "lucide-react";
import { IconButton } from "@/app/components/design-system/IconButton";
import { cn } from "@/app/components/design-system/cn";
import { isSidebarItemActive, sidebarNavigation } from "@/app/components/navigation/sidebar";
import { isNavigationItemActive, type ModuleNavigation, type NavigationItem } from "@/app/components/navigation/types";
import type { Role } from "@/lib/auth/roles";
import { AppShell } from "./AppShell";
import { AppUserMenu } from "./AppUserMenu";
import { AppClock } from "./AppClock";
import { ModuleNav } from "./ModuleNav";
import type { AppNavbarUser } from "./AppNavbar";

type Mode = "expanded" | "compact" | "hidden";
const control = "text-snake-text-on-dark hover:bg-snake-app-elevated focus-visible:ring-snake-focus-on-dark";
const linkClass = "flex min-h-11 items-center gap-3 rounded-snake-control px-3 text-sm font-medium hover:bg-snake-app-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark";

function SidebarLink({ item, compact, onNavigate, pathname }: { item: NavigationItem; compact: boolean; onNavigate?: () => void; pathname: string }) {
    const Icon = item.icon;
    const active = isSidebarItemActive(pathname, item);
    return <Link key={item.id} href={item.href} onClick={onNavigate}
      title={compact ? item.label : undefined} aria-label={compact ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(linkClass, active ? "bg-snake-hero text-snake-text-on-dark" : "text-snake-text-on-dark-muted", compact && "justify-center px-2")}>
      {Icon && <Icon size={20} aria-hidden="true" className="shrink-0" />}
      {!compact && <span>{item.label}</span>}
    </Link>;
  }

function NavigationContents({compact, onNavigate, pathname, navigation}: {compact: boolean; onNavigate?: () => void; pathname: string; navigation: ReturnType<typeof sidebarNavigation>}) {
    return <>
      <nav aria-label="Arbeidsområder" className="space-y-1">
        {navigation.main.map(item => item.children.length && !compact ?
          <details key={`${item.id}:${pathname}`} open={isNavigationItemActive(pathname, item)} className="group">
            <summary className={cn(linkClass, "cursor-pointer list-none text-snake-text-on-dark-muted", isNavigationItemActive(pathname, item) && "bg-snake-hero text-snake-text-on-dark")}>
              {item.icon && <item.icon size={20} aria-hidden="true" className="shrink-0" />}
              <span>{item.label}</span><ChevronDown size={16} aria-hidden="true" className="ml-auto group-open:rotate-180" />
            </summary>
            <div className="ml-5 mt-1 space-y-1 border-l border-snake-border-on-dark-default pl-2">
              {item.children.map(child => <SidebarLink key={child.id} item={child} compact={false} onNavigate={onNavigate} pathname={pathname} />)}
            </div>
          </details> : <SidebarLink key={item.id} item={item} compact={compact} onNavigate={onNavigate} pathname={pathname} />)}
      </nav>
      {navigation.employees.length > 0 && <nav aria-label="Digitale medarbeidere" className="mt-5 space-y-1 border-t border-snake-border-on-dark-default pt-4">
        {!compact && <p className="px-3 pb-2 text-xs font-semibold text-snake-text-on-dark-muted">Digitale medarbeidere</p>}
        {navigation.employees.map(item => <SidebarLink key={item.id} item={item} compact={compact} onNavigate={onNavigate} pathname={pathname} />)}
      </nav>}
      {navigation.admin.length > 0 && <nav aria-label="Administrasjon" className="mt-5 space-y-1 border-t border-snake-border-on-dark-default pt-4">
        {!compact && <p className="px-3 pb-2 text-xs font-semibold text-snake-text-on-dark-muted">Administrasjon</p>}
        {navigation.admin.map(item => <SidebarLink key={item.id} item={item} compact={compact} onNavigate={onNavigate} pathname={pathname} />)}
      </nav>}
    </>;
  }

export function SidebarShell({ children, role, user, logoutSlot, moduleNavigation, width = "wide" }: {
  children: ReactNode; role?: Role; user: AppNavbarUser; logoutSlot?: ReactNode;
  moduleNavigation?: ModuleNavigation; width?: "default" | "wide";
}) {
  const [mode, setMode] = useState<Mode>("expanded");
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef<string | null>(null);
  const navigation = sidebarNavigation(role, moduleNavigation);

  function restoreScroll() {
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
  }
  function openMobile() {
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
  }
  function closeMobile() { dialog.current?.close(); }
  useEffect(() => () => {
    if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
  }, []);
  function changeMode(next: Mode) {
    setMode(next);
    // Controls in the sidebar can disappear; keep keyboard focus on a stable control.
    menuButton.current?.focus();
  }
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (media.matches && dialog.current?.open) {
        dialog.current.close();
        menuButton.current?.focus();
      }
    };
    media.addEventListener("change", onResize);
    return () => media.removeEventListener("change", onResize);
  }, []);


  return <div className={cn("min-h-screen bg-snake-app lg:grid print:block", mode === "expanded" ? "lg:grid-cols-[16rem_minmax(0,1fr)]" : mode === "compact" ? "lg:grid-cols-[4.5rem_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)]")}>
    {mode !== "hidden" && <aside id="snake-desktop-navigation" aria-label="Hovedmeny" className="sticky top-0 hidden h-dvh flex-col border-r border-snake-border-on-dark-default bg-snake-app-deep text-snake-text-on-dark lg:flex print:hidden">
      <div className={cn("flex min-h-16 items-center px-3", mode === "compact" && "justify-center")}>
        {mode === "expanded" && <Link href="/dashboard" className="mr-auto rounded-snake-control px-3 font-semibold tracking-widest text-snake-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark">SNAKE OS</Link>}
        <IconButton variant="ghost" className={control} title={mode === "compact" ? "Utvid meny" : "Komprimer meny"} aria-label={mode === "compact" ? "Utvid meny" : "Komprimer meny"} onClick={() => changeMode(mode === "compact" ? "expanded" : "compact")}>
          {mode === "compact" ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-5"><NavigationContents compact={mode === "compact"} pathname={pathname} navigation={navigation} /></div>
      <div className="border-t border-snake-border-on-dark-default p-2"><SidebarLink item={{ id: "account", href: "/account", label: "Konto", icon: UserRound }} compact={mode === "compact"} pathname={pathname} /></div>
    </aside>}
    <div className="min-w-0">
      <AppShell width={width}
        moduleNav={moduleNavigation && !navigation.main.some(item => item.id === moduleNavigation.id)
          ? <ModuleNav navigation={moduleNavigation} /> : undefined}
        navbar={<header className="sticky top-0 z-40 border-b border-snake-border-on-dark-default bg-snake-app-deep text-snake-text-on-dark print:hidden">
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
          <button ref={menuButton} type="button" className={cn(linkClass, "hidden lg:flex", control)} aria-label={mode === "hidden" ? "Åpne navigasjon" : "Skjul navigasjon"} aria-expanded={mode !== "hidden"} onClick={() => changeMode(mode === "hidden" ? "expanded" : "hidden")}><Menu size={20} aria-hidden="true" /><span>{mode === "hidden" ? "Vis meny" : "Skjul meny"}</span></button>
          <button ref={mobileButton} type="button" className={cn(linkClass, "lg:hidden", control)} aria-label="Åpne navigasjon" aria-haspopup="dialog" onClick={openMobile}><Menu size={20} aria-hidden="true" /><span>Meny</span></button>
          <Link href="/dashboard" className="rounded-snake-control text-sm font-semibold tracking-widest text-snake-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark">SNAKE OS</Link>
          <div className="ml-auto hidden text-sm text-snake-text-on-dark-muted xl:block"><AppClock /></div>
          <div className="ml-auto xl:ml-0"><AppUserMenu displayName={user.displayName} roleLabel={user.roleLabel} logoutSlot={logoutSlot} /></div>
        </div>
      </header>}>{children}</AppShell>
    </div>
    <dialog ref={dialog} aria-labelledby="snake-mobile-menu-title"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, [tabindex="0"]',
        )).filter(element => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      onClose={() => { restoreScroll(); if (!window.matchMedia("(min-width: 1024px)").matches) mobileButton.current?.focus(); }}
      onClick={event => { if (event.target === event.currentTarget) closeMobile(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-snake-text-on-dark backdrop:bg-snake-overlay open:flex print:hidden">
      <div className="flex h-full w-[min(22rem,calc(100%-2rem))] flex-col border-r border-snake-border-on-dark-default bg-snake-app-deep shadow-snake-overlay">
        <div className="flex min-h-16 shrink-0 items-center justify-between px-4"><h2 id="snake-mobile-menu-title" className="font-semibold tracking-widest text-snake-brand">SNAKE OS</h2><IconButton variant="ghost" className={control} aria-label="Lukk navigasjon" onClick={closeMobile}><X size={20} /></IconButton></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6"><NavigationContents compact={false} onNavigate={closeMobile} pathname={pathname} navigation={navigation} /></div>
        <div className="shrink-0 border-t border-snake-border-on-dark-default px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"><SidebarLink item={{ id: "account", href: "/account", label: "Konto" }} compact={false} onNavigate={closeMobile} pathname={pathname} />{logoutSlot}</div>
      </div>
    </dialog>
  </div>;
}
