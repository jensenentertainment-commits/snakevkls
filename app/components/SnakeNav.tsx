"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import SnakeLogoutButton from "./SnakeLogoutButton";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Boxes,
  ClipboardCheck,
  FlaskConical,
  MapPin,
  Package,
  Search,
  Settings,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { isRole, type Role } from "@/lib/auth/roles";


type Profile = {
  role: Role;
  active: boolean;
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
    try {
      const cachedProfile = JSON.parse(cached) as Partial<Profile>;

      if (
        cachedProfile.active === true &&
        isRole(cachedProfile.role) &&
        typeof cachedProfile.display_name !== "undefined"
      ) {
        setProfile(cachedProfile as Profile);
      } else {
        window.localStorage.removeItem("snake_profile");
      }
    } catch {
      window.localStorage.removeItem("snake_profile");
    }
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
      .select("role, display_name, active")
      .eq("id", user.id)
      .single();
const nextProfile = data as Profile | null;

setProfile(nextProfile?.active && isRole(nextProfile.role) ? nextProfile : null);

if (nextProfile?.active && isRole(nextProfile.role)) {
  window.localStorage.setItem("snake_profile", JSON.stringify(nextProfile));
} else {
  window.localStorage.removeItem("snake_profile");
}
    
  }

  const isAdmin = profile?.role === "admin";
const pathname = usePathname();
  return (
    <header className="relative z-[9999] mb-8 flex items-center justify-between gap-6">
      <Link href="/dashboard" className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] shadow-lg shadow-black/20">
          <Image
            src="/vk_logo2.png"
            alt="Varekompaniet logo"
            width={200}
            height={200}
            className="h-24 w-24 object-contain"
            priority
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/72">
            SNAKE OS
          </p>
          
        </div>
      </Link>

      <nav className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-[#083844]/88 p-1 shadow-lg shadow-black/20 backdrop-blur-xl md:flex">
  <NavLink href="/lager" label="Lager" icon={<Package />} pathname={pathname} />
  <NavLink href="/products" label="Produkter" icon={<Search />} pathname={pathname} />
  <NavLink href="/locations" label="Lokasjoner" icon={<MapPin />} pathname={pathname} />

  <div className="mx-1 h-6 w-px bg-white/10" />

  <NavLink href="/fix-locations" label="Ryddemodus" icon={<Wrench />} pathname={pathname} />
  <NavLink href="/issues" label="Avvik" icon={<TriangleAlert />} pathname={pathname} />
  <NavLink href="/location-count" label="Telling" icon={<ClipboardCheck />} pathname={pathname} />
  <NavLink href="/activities" label="Aktivitet" icon={<Activity />} pathname={pathname} />
</nav>

{isAdmin && (
  <Link
    href="/settings"
    title="Innstillinger"
    className={`inline-flex h-12 w-12 items-center justify-center rounded-full border transition ${
      pathname.startsWith("/settings")
        ? "border-[#b58a14]/40 bg-[#b58a14] text-white shadow-lg shadow-[#b58a14]/25"
        : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
    }`}
  >
    <Settings className="h-[18px] w-[18px]" />
  </Link>
)}

        
{isAdmin && (
  <Link
    href="/labs"
    title="Labs"
    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
      pathname.startsWith("/labs")
        ? "border-violet-400/50 bg-violet-500 text-white"
        : "border-violet-400/25 bg-violet-500/10 text-violet-200 hover:border-violet-400/50 hover:bg-violet-500/20 hover:text-white"
    }`}
  >
    <FlaskConical className="h-4 w-4" />
    LABS
  </Link>
)}



<Link
  href="/borre"
  title="Børre"
  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
    pathname.startsWith("/borre")
      ? "border-[#b58a14]/50 bg-[#b58a14] text-white"
      : "border-[#b58a14]/35 bg-[#b58a14]/10 text-[#e8c25a] hover:border-[#b58a14]/60 hover:bg-[#b58a14]/20 hover:text-white"
  }`}
>
  <Bot className="h-4 w-4" />
  BØRRE
</Link>

        

   



      <div ref={userMenuRef} className="relative z-[500] pl-3">
  <button
  type="button"
  onClick={() => setUserMenuOpen((open) => !open)}
  className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#b58a14]/35 bg-gradient-to-br from-[#0b4a5a] via-[#063640] to-[#042834] text-[14px] font-bold text-[#f7f3e8] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.35)] transition hover:border-[#d2a32c]/55"
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
    className={`absolute right-0 top-14 z-[9999] w-[240px] rounded-2xl border border-white/10 bg-[#042834]/95 p-4 text-left shadow-2xl shadow-black/35 backdrop-blur transition ${
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
<Link
  href="/account"
  className="block rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
>
  Brukerprofil
</Link>
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-2">
      <SnakeLogoutButton />
    </div>
  </div>
</div>
  
      
    </header>
  );
}

function NavLink({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
        active
          ? "border-[#b58a14]/45 bg-[#b58a14]/20 text-white"
          : "border-transparent text-white/58 hover:border-white/10 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
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
