import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, GitBranch } from "lucide-react";

import SnakeNav from "../components/SnakeNav";
import SnakeFooter from "../components/SnakeFooter";
import { SNAKE_VERSION } from "@/lib/version";

const versions = [
  {
    version: "v1.0",
    title: "System etablert",
    status: "Aktiv",
    tone: "active",
    items: [
      "Første operative versjon av Snake VKLS.",
      "Varesøk tilgjengelig for oppslag av produkter og lagerdata.",
      "Lokasjonsstruktur etablert med soner og lagerplasser.",
      "Avvik identifiseres og prioriteres.",
      "Ryddemodus introdusert for håndtering av manglende lokasjoner.",
    ],
  },
  {
    version: "v1.1",
    title: "Redusert friksjon",
    status: "Planlagt",
    tone: "planned",
    items: [
      "Ryddemodus forbedres med raskere flyt mellom produkter.",
      "Tydeligere status på produkter uten lokasjon.",
      "Forbedret navigasjon mellom avvik og produkter.",
      "Mindre behov for manuelt oppslag under rydding.",
    ],
  },
  {
    version: "v1.2",
    title: "Struktur og kontroll",
    status: "Planlagt",
    tone: "planned",
    items: [
      "Bedre sortering av lokasjoner.",
      "Mer konsistent visning av SKU og variantdata.",
      "Forbedret lesbarhet i arbeidsflater.",
      "Små justeringer for å redusere feilregistrering.",
    ],
  },
  {
    version: "v2.0",
    title: "Plukkmodul",
    status: "Kommer",
    tone: "future",
    items: [
      "Plukkmodul aktiveres.",
      "Lagerflyt går fra kontroll til operasjon.",
      "Systemet brukes direkte i ordrebehandling.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-[#003b46] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[32px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#06617f] via-[#05495b] to-[#032c35] px-5 py-8 text-white sm:px-8 lg:px-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

            <Link
              href="/"
              className="relative mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Til forsiden
            </Link>

            <p className="relative text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
              Snake VKLS
            </p>

            <h1 className="relative mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Systemendringer
            </h1>

            <p className="relative mt-4 max-w-2xl text-base leading-7 text-white/75">
              Endringer som påvirker hvordan lageret brukes. Mindre justeringer
              dokumenteres ikke alltid.
            </p>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="rounded-[26px] border border-black/10 bg-white shadow-sm">
              <div className="border-b border-black/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#055a7d]/10 text-[#055a7d]">
                    <GitBranch className="h-6 w-6" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                      Versjonshistorikk
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Operative endringer i Snake VKLS.
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-black/10">
                {versions.map((entry) => (
                  <article key={entry.version} className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              entry.tone === "active"
                                ? "bg-[#d4a72c] text-black"
                                : entry.tone === "planned"
                                  ? "bg-[#055a7d]/10 text-[#055a7d]"
                                  : "bg-neutral-100 text-neutral-500"
                            }`}
                          >
                            {entry.version}
                          </span>

                          <h3 className="text-2xl font-semibold tracking-tight">
                            {entry.title}
                          </h3>
                        </div>

                        <ul className="mt-5 space-y-3">
                          {entry.items.map((item) => (
                            <li
                              key={item}
                              className="flex gap-3 text-sm leading-6 text-neutral-600"
                            >
                              {entry.tone === "active" ? (
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#055a7d]" />
                              ) : (
                                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
                              )}
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div
                        className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                          entry.tone === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {entry.status}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}