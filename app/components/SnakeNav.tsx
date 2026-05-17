"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SnakeLogoutButton from "./SnakeLogoutButton";
import { usePathname } from "next/navigation";
import { SNAKE_VERSION } from "@/lib/version";


type Profile = {
  role: "admin" | "lager" | "viewer";
  display_name: string | null;
};

export default function SnakeNav() {
 const [profile, setProfile] = useState<Profile | null>(null);
const [mounted, setMounted] = useState(false);
const [userMenuOpen, setUserMenuOpen] = useState(false);
const userMenuRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
  setMounted(true);

  const cached = window.localStorage.getItem("snake_profile");

  if (cached) {
    setProfile(JSON.parse(cached) as Profile);
  }

  loadProfile();
}, []);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      userMenuRef.current &&
      !userMenuRef.current.contains(event.target as Node)
    ) {
      setUserMenuOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .single();
const nextProfile = data as Profile | null;

setProfile(nextProfile);

if (nextProfile) {
  window.localStorage.setItem("snake_profile", JSON.stringify(nextProfile));
}
    
  }

  const isAdmin = profile?.role === "admin";
const pathname = usePathname();
  return (
    <header className="mb-8 flex items-center justify-between gap-6">
      <Link href="/" className="flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] shadow-lg shadow-black/20">
          <Image
            src="/vk_logo2.png"
            alt="Varekompaniet logo"
            width={200}
            height={200}
            className="h-32 w-32 object-contain"
            priority
          />
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/72">
            SNAKE VKLS
          </p>
          <h1 className="text-sm font-bold uppercase tracking-tight text-white">
            Varekompaniets Lagersystem
          </h1>
        </div>
      </Link>

      <nav className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.045] p-1 shadow-lg shadow-black/20 md:flex">
        <NavLink href="/" label="Forside" pathname={pathname} />
        <NavLink href="/products" label="Produkter" pathname={pathname} />
        <NavLink href="/locations" label="Lokasjoner" pathname={pathname} />
        <NavLink href="/issues" label="Avvik" pathname={pathname}/>
        <NavLink href="/activities" label="Aktivitet" pathname={pathname} />

        {isAdmin && (
  <Link
    href="/settings"
    title="Innstillinger"
    className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${
      pathname.startsWith("/settings")
        ? "bg-[#b58a14] text-white shadow-lg shadow-[#b58a14]/25"
        : "text-white/68 hover:bg-[color:rgba(75,108,147,0.18)] hover:text-white"
    }`}
  >
    <Settings className="h-[18px] w-[18px]" />
  </Link>
)}

<Link
  href="/changelog"
  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/10 hover:text-white/70"
>
  SNAKE v{SNAKE_VERSION}
</Link>

      <div ref={userMenuRef} className="relative pl-3">
  <button
  type="button"
  onClick={() => setUserMenuOpen((open) => !open)}
  className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#b58a14]/35 bg-gradient-to-br from-[#0b4a5a] via-[#063640] to-[#042834] text-[14px] font-bold text-[#f7f3e8] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.35)] transition hover:scale-[1.03] hover:border-[#d2a32c]/55"
  title={`${profile?.display_name ?? "Bruker"} · ${profile?.role ?? "ukjent"}`}
>
  <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_42%)]" />

<span className="absolute inset-[4px] rounded-full border border-white/10" />

  

  <span className="relative tracking-[0.04em]">
    {mounted && profile?.display_name
      ? getInitials(profile.display_name)
      : ""}
  </span>
</button>

  <div
    className={`absolute right-0 top-14 z-50 w-[240px] rounded-2xl border border-white/10 bg-[#042834]/95 p-4 text-left shadow-2xl shadow-black/35 backdrop-blur transition ${
      userMenuOpen
        ? "pointer-events-auto opacity-100"
        : "pointer-events-none opacity-0"
    }`}
  >
    <div className="flex items-center gap-3">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
          isAdmin ? "bg-[#b58a14] text-white" : "bg-white/10 text-white"
        }`}
      >
        {mounted && profile?.display_name
          ? getInitials(profile.display_name)
          : ""}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          {profile?.display_name ?? "Bruker"}
        </p>

        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/45">
          {profile?.role ?? "ukjent"}
        </p>
      </div>
    </div>

    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-2">
      <SnakeLogoutButton />
    </div>
  </div>
</div>
  
      </nav>
    </header>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active =
    href === "/"
      ? pathname === "/"
      : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white/14 text-white shadow-inner shadow-white/5"
          : "text-white/68 hover:bg-[color:rgba(75,108,147,0.18)] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function getInitials(name: string | null) {
  if (!name) return "?";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}