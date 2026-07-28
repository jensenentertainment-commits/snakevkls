"use client";

import Link from "next/link";
import SnakeHero from "../components/SnakeHero";
import RoleGate from "../components/auth/RoleGate";

const modules = [
{
  href: "/arne",
  eyebrow: "Arne",
  title: "Arnes kontor",
  description:
    "Adminassistent for utvikling av Snake, prioritering, arbeidsflyt og nye moduler.",
  status: "Aktiv",
},

  {
    href: "/labs/shopify-control",
    eyebrow: "Control",
    title: "Shopify Control",
    description:
      "Finn produkter som mangler bilde, SEO, kategori eller lagerdata.",
    status: "Planlagt",
  },
 
];

export default function LabsPage() {
  return (
    <RoleGate allowedRoles={["admin"]} withinAppShell>
      <div className="mx-auto max-w-7xl px-6 py-8">
            <SnakeHero
              eyebrow="Snake OS"
              title="Operativsystemet bak Varekompaniet"
              description="Adminverktøy for produktflyt, Shopify-kontroll, migrering, AI og datavask. SOS når nettbutikken trenger rydding."
            />

            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => {
                const isActive = module.status === "Aktiv";

                return (
                  <Link
                    key={module.href}
                    href={isActive ? module.href : "#"}
                    className={`group rounded-3xl border p-6 shadow-xl transition ${
                      isActive
                        ? "border-white/10 bg-[#0d1720] hover:border-[#b58a14]/60 hover:bg-[#101f2c]"
                        : "cursor-not-allowed border-white/5 bg-[#0d1720]/60 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
                        {module.eyebrow}
                      </div>

                      <div
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${
                          isActive
                            ? "border-emerald-400/30 text-emerald-300"
                            : "border-white/10 text-slate-400"
                        }`}
                      >
                        {module.status}
                      </div>
                    </div>

                    <h2 className="mt-3 text-2xl font-black">
                      {module.title}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {module.description}
                    </p>

                    <div className="mt-6 text-sm font-bold text-[#d2a32c]">
                      {isActive ? "Åpne modul →" : "Kommer senere"}
                    </div>
                  </Link>
                );
              })}
            </section>

            <section className="mt-8 rounded-3xl border border-white/10 bg-[#0d1720] p-6 shadow-xl">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
                Systemstatus
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  ["Shopify", "Tilkoblet"],
                  ["Snake WMS", "Aktiv"],
                  ["Snake AI", "Under utvikling"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-[#071018] p-4"
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </div>
                    <div className="mt-2 text-lg font-black">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

      </div>
    </RoleGate>
  );
}
