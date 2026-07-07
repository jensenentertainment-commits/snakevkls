import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/auth";

import { getBorreDashboardBrief } from "@/lib/intelligence/borre/dashboard-brief";

type DashboardCard = {
  title: string;
  href: string;
  description: string;
  roles: Role[];
};



const cards: DashboardCard[] = [
  {
    title: "Lager",
    href: "/lager",
    description: "Produkter, lokasjoner og lagerhelse.",
    roles: ["admin", "lager", "viewer"],
  },
  {
    title: "Ordre",
    href: "/ordre",
    description: "Manuelle ordre og salg utenfor Shopify.",
    roles: ["admin", "lager", "viewer"],
  },
  {
  title: "Børre",
  href: "/borre",
  description: "Er du i tvil, spør Børre.",
  roles: ["admin", "lager", "viewer"],
},
  {
    title: "Viper",
    href: "/viper",
    description: "Ordreplukk.",
    roles: ["admin", "lager"],
  },
  {
    title: "Labs",
    href: "/labs",
    description: "Eksperimenter og admin-verktøy.",
    roles: ["admin"],
  },
  {
    title: "Innstillinger",
    href: "/innstillinger",
    description: "System, roller og oppsett.",
    roles: ["admin"],
  },
];




function getTimeOfDayText() {
  const hour = new Date().getHours();

  if (hour < 10) return { greeting: "God morgen", welcome: "Børre håper kaffen virker etter hensikten." };
  if (hour < 14) return { greeting: "God formiddag", welcome: "Lageret virker samarbeidsvillig så langt." };
  if (hour < 18) return { greeting: "God ettermiddag", welcome: "Børre registrerer fortsatt aktivitet i systemet." };

  return { greeting: "God kveld", welcome: "Dagen nærmer seg slutten. Lageret gjør sitt beste." };
}

export const dynamic = "force-dynamic";



export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

    const { greeting, welcome } = getTimeOfDayText();

  const role = (profile?.role ?? "viewer") as Role;
  const fullName = profile?.display_name || user.email || "bruker";
const firstName = fullName.split(" ")[0];

  const visibleCards = cards.filter((card) => card.roles.includes(role));

const borre = await getBorreDashboardBrief();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#062f3b] px-4 py-5 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <img
          src="/snake2.png"
          alt=""
          className="w-[780px] max-w-none rotate-[6deg] opacity-[0.055] blur-[1px]"
        />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
            Snake OS
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
  {greeting}, {firstName}.
</h1>

          <div className="mt-4 h-px w-14 bg-gradient-to-r from-[#b58a14] to-transparent" />

     <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">
  {borre.message}
</p>
        </section>

   

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex h-[175px] flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_12px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#b58a14]/40 hover:bg-white/[0.065]"
            >
              <div>
                <div className="h-1 w-10 rounded-full bg-[#b58a14]/80" />

                <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
                  {card.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  {card.description}
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b58a14]">
                Åpne →
              </p>
            </Link>
          ))}

          
        </section>
       
      </div>
    </main>
  );
}