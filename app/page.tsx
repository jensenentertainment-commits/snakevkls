import Link from "next/link";
import {
  Search,
  MapPin,
  AlertTriangle,
  PackageCheck,
  Boxes,
  Activity,
  Clock,
  Cuboid,
} from "lucide-react";

import SnakeNav from "./components/SnakeNav";
import SnakeFooter from "./components/SnakeFooter";

export default function HomePage() {
  const hasIssues = true;
  const issueCount = 3;

  const modules = [
    {
      href: "/products",
      icon: <Search />,
      title: "Varesøk",
      label: "Aktiv",
      text: "Finn produkt...",
      body: "...",
      action: "Åpne varesøk",
      featured: true,
    },
    {
      href: "/locations",
      icon: <MapPin />,
      title: "Lokasjoner",
      label: "Aktiv",
      text: "...",
      body: "...",
      action: "Administrer lokasjoner",
    },
    {
      href: "/issues",
      icon: <AlertTriangle />,
      title: "Avvik",
      label: hasIssues ? `${issueCount} avvik` : "OK",
      text: "Varer uten lokasjon...",
      body: "...",
      action: "Åpne avvik",
      featured: hasIssues,
    },
    {
      icon: <PackageCheck />,
      title: "Plukk",
      label: "Snart",
      text: "...",
      body: "...",
      muted: true,
    },
  ];

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
        <SnakeNav />

        <section className="overflow-hidden rounded-[32px] bg-white text-neutral-950 shadow-2xl shadow-black/30">
          <div className="grid gap-7 bg-gradient-to-br from-[#055a7d] to-[#042834] px-5 py-7 text-white sm:px-8 sm:py-9 lg:grid-cols-[1fr_auto] lg:items-start lg:px-10 lg:py-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
                SNAKE VKLS
              </p>

              <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[0.95] tracking-[-0.05em] sm:mt-4 md:text-6xl">
                Varekompaniets interne lagersystem.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">
                Finn produkter, kontroller lokasjoner og bygg ryddigere
                lagerdata før plukk og ordrebehandling.
              </p>
            </div>

            <StatusStrip />
          </div>

          <div className="bg-[#f6f7f8] px-8 py-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((module) => (
                <ModuleCard key={module.title} {...module} />
              ))}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <WideCard
                href="/locations"
                icon={<Boxes />}
                title="Lagerstruktur"
                text="Gyldige lokasjonsvalg, aktive plasser og faste plasseringer."
                action="Gå til lagerstruktur"
              />

              <WideCard
                icon={<Activity />}
                title="Systemstatus"
                text={
                  hasIssues
                    ? `${issueCount} registrerte avvik krever oppfølging.`
                    : "Ingen registrerte avvik akkurat nå."
                }
                action="Se systemstatus"
              />
            </div>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}

function StatusStrip() {
  return (
    <div className="rounded-[22px] border border-white/15 bg-white/10 p-2 shadow-xl shadow-black/20 backdrop-blur md:p-4">
      <div className="grid gap-2 md:grid-cols-3 md:gap-4">
        <StatusItem mark="V1" label="Versjon" value="1.0" />
        <StatusItem
          icon={<Cuboid className="h-4 w-4 md:h-5 md:w-5" />}
          label="Moduler"
          value="3 aktive"
        />
        <StatusItem
          icon={<Clock className="h-4 w-4 md:h-5 md:w-5" />}
          label="Neste modul"
          value="Plukk"
        />
      </div>
    </div>
  );
}

function StatusItem({
  icon,
  mark,
  label,
  value,
}: {
  icon?: React.ReactNode;
  mark?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-3 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:border-r md:border-white/15 md:last:border-r-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/12 text-base font-bold text-white md:h-11 md:w-11 md:text-lg">
        {mark ?? icon}
      </div>

      <div>
        <p className="text-xs text-white/58 md:text-sm">{label}</p>
        <p className="mt-0.5 text-base font-semibold text-white md:text-lg">
          {value}
        </p>
      </div>
    </div>
  );
}

function ModuleCard({
  href,
  icon,
  title,
  label,
  text,
  body,
  action,
  featured,
  muted,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  label: string;
  text: string;
  body: string;
  action?: string;
  featured?: boolean;
  muted?: boolean;
}) {
  const card = (
    <div
     className={`group flex min-h-[240px] flex-col rounded-[24px] border bg-white p-5 shadow-sm transition duration-200 sm:min-h-[315px] sm:p-6 ${
        featured
          ? "border-[#b58a14]/55 shadow-[0_0_0_1px_rgba(181,138,20,0.14),0_18px_42px_rgba(0,0,0,0.10)]"
          : "border-neutral-200"
      } ${
        muted
          ? "opacity-55 grayscale-[0.2]"
          : "hover:-translate-y-1 hover:shadow-xl"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border ${
            featured
              ? "border-[#b58a14]/30 bg-[#b58a14]/10 text-[#b58a14]"
              : "border-[#055a7d]/15 bg-[#055a7d]/7 text-[#055a7d]"
          }`}
        >
          <span className="[&>svg]:h-8 [&>svg]:w-8">{icon}</span>
        </div>

        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${
            featured
              ? "bg-[#b58a14]/10 text-[#a77e04]"
              : muted
                ? "bg-neutral-100 text-neutral-400"
                : "bg-[#055a7d]/8 text-[#055a7d]"
          }`}
        >
          {label}
        </span>
      </div>

      <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
        {title}
      </h2>

      <p className="mt-3 text-base leading-6 text-neutral-700">{text}</p>

      <div className="my-5 h-px bg-neutral-200" />

      <p className="text-sm leading-6 text-neutral-500">{body}</p>

      <div className="mt-auto pt-6">
        <span
          className={`text-sm font-bold ${
            featured
              ? "text-[#b58a14]"
              : muted
                ? "text-neutral-400"
                : "text-[#055a7d] group-hover:text-[#042834]"
          }`}
        >
          {action ?? "Kommer snart"}
          {action ? " →" : ""}
        </span>
      </div>
    </div>
  );

  if (!href || muted) return card;
  return <Link href={href}>{card}</Link>;
}

function WideCard({
  href,
  icon,
  title,
  text,
  action,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  action: string;
}) {
  const card = (
    <div className="group rounded-[24px] border border-neutral-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#055a7d]/15 bg-[#055a7d]/7 text-[#055a7d] sm:h-16 sm:w-16">
          <span className="[&>svg]:h-8 [&>svg]:w-8">{icon}</span>
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-neutral-950">
            {title}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
            {text}
          </p>
          <p className="mt-3 text-sm font-bold text-[#055a7d] group-hover:text-[#042834]">
            {action} →
          </p>
        </div>
      </div>
    </div>
  );

  if (!href) return card;
  return <Link href={href}>{card}</Link>;
}