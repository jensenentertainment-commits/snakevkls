import Link from "next/link";
import {
  Search,
  MapPin,
  AlertTriangle,
  PackageCheck,
  Boxes,
  Activity,
  ArrowRight,
  Wrench,
} from "lucide-react";

import SnakeNav from "./components/SnakeNav";
import SnakeFooter from "./components/SnakeFooter";
import { SNAKE_VERSION } from "../lib/version";
import { getDashboardStats } from "@/lib/dashboard";
type IssueCardState = {
  border: string;
  bg: string;
  badge: string;
  icon: string;
  action: string;
  hover: string;
};
export default async function HomePage() {
  const {
    missingLocationCount,
    missingSkuCount,
    emptyLocationCount,
  } = await getDashboardStats();
  const issueCount =
  missingLocationCount + missingSkuCount + emptyLocationCount;





const hasIssues = issueCount > 0;
const issueState: IssueCardState = hasIssues
  ? {
      border: "border-red-300",
      bg: "bg-red-50",
      badge: "bg-red-100 text-red-700",
      icon: "border-red-200 bg-red-100 text-red-600 ring-red-100",
      action: "text-red-700",
      hover: "hover:border-red-300 hover:shadow-[0_18px_45px_rgba(239,68,68,0.14)]",
    }
  : {
      border: "border-green-300",
      bg: "bg-green-50",
      badge: "bg-green-100 text-green-700",
      icon: "border-green-200 bg-green-100 text-green-600 ring-green-100",
      action: "text-green-700",
      hover: "hover:border-green-300 hover:shadow-[0_18px_45px_rgba(34,197,94,0.12)]",
    };

    const shouldHighlightCleanup = hasIssues && issueCount > 0;

  const modules = [
    {
      href: "/products",
      icon: <Search />,
      title: "Varesøk",
      label: "Aktiv",
      text: "Finn produkter, SKU-er og lagerstatus raskt.",
      body: "Søk på produktnavn, variant, SKU, sone og lokasjon. Brukes som hovedinngang til lagerdata.",
      action: "Åpne varesøk",
      
    },
    {
      href: "/locations",
      icon: <MapPin />,
      title: "Lokasjoner",
      label: "Aktiv",
      text: "Administrer soner og lagerplasser.",
      body: "Opprett, rediger og kontroller lokasjoner. QR og labels gjør strukturen fysisk brukbar.",
      action: "Administrer lokasjoner",
    },

        
 {
  href: "/fix-locations",
  icon: <Wrench />,
  title: "Ryddemodus",
  label: shouldHighlightCleanup ? "Neste steg" : "Klar",
  text: shouldHighlightCleanup
    ? "Plasser produkter som mangler lokasjon."
    : "Ingen akutt rydding nødvendig.",
  body: shouldHighlightCleanup
    ? "Går gjennom én vare av gangen og lar deg sette lokasjon uten å måtte hoppe mellom produkter og avvik."
    : "Når nye produkter mangler lokasjon, blir ryddemodus anbefalt her.",
  action: shouldHighlightCleanup ? "Start ryddemodus" : "Åpne ryddemodus",
  highlight: shouldHighlightCleanup,
},

    {
      href: "/issues",
      icon: <AlertTriangle />,
      title: "Avvik",
      label: hasIssues ? `${issueCount} avvik` : "OK",
      text: "Rydd feil som stopper plukk.",
      body: "Produkter uten lokasjon, manglende SKU, tomme lokasjoner og strukturfeil samles her.",
      action: "Åpne avvik",
      
    },


    {
      icon: <PackageCheck />,
      title: "Plukk",
      label: "Snart",
      text: "Plukkflyt kommer senere.",
      body: "Modulen aktiveres når lagerstruktur og produktplasseringer er stabile nok.",
      muted: true,
    },
  ];

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
     <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
             <SnakeNav />
     
            

        <section className="overflow-hidden rounded-[28px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30">
          <div className="relative overflow-hidden bg-[#05495b] px-5 py-4 text-white sm:px-8 sm:py-5 lg:px-10 lg:py-5">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute left-10 top-10 h-32 w-32 rounded-full border border-white/10" />

  <Link href="/changelog" className="absolute right-4 top-4 sm:right-8 sm:top-6">
  <div className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/50 backdrop-blur hover:bg-white/15 hover:text-white/70">
    SNAKE V{SNAKE_VERSION}
  </div>
</Link>

            <div className="relative grid gap-8 lg:grid-cols-[1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">
                  SNAKE VKLS
                </p>

                <h1 className="mt-2 max-w-4xl text-3xl font-semibold leading-[0.95] tracking-[-0.05em] sm:text-4xl md:text-[44px]">
                  Varekompaniets lagersystem.
                </h1>

          {hasIssues && (
  <p className="mt-1 text-xs text-white/70">
    <span className="font-semibold text-white">
      {missingLocationCount}
    </span>{" "}
    uten lokasjon ·{" "}
    <span className="font-semibold text-white">
      {missingSkuCount}
    </span>{" "}
    uten SKU ·{" "}
    <span className="font-semibold text-white">
      {emptyLocationCount}
    </span>{" "}
    tomme lokasjoner
  </p>
)}

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                  Finn produkter, kontroller lokasjoner og bygg ryddigere
                  lagerdata før plukk og ordrebehandling.
                </p>
              </div>

           
            </div>
          </div>

          <div className="px-5 py-5 sm:px-8 sm:py-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#055a7d]/70">
                  Moduler
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
                  Arbeidsflate
                </h2>
              </div>

              <p className="max-w-xl text-sm leading-6 text-neutral-600">
                Start med varesøk og avvik. Lokasjoner brukes når lageret skal
                ryddes fysisk.
              </p>
            </div>

            <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-5">
             {modules.map((module) => (
  <ModuleCard
    key={module.title}
    {...module}
    issueState={module.title === "Avvik" ? issueState : undefined}
    
  />
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
  href="/activities"
  icon={<Activity />}
  title="Aktivitetslogg"
  text="Siste endringer i lokasjoner, soner, varer og avvik."
  action="Åpne aktivitetslogg"
  warning={hasIssues}
/>
            </div>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
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
  muted,
  issueState,
  highlight,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  label: string;
  text: string;
  body: string;
  action?: string;
  
muted?: boolean;
issueState?: IssueCardState | null;
highlight?: boolean;
}) {

  const card = (
    <div
      className={`group relative flex h-full min-h-[310px] flex-col overflow-hidden rounded-[24px] border p-5 shadow-sm transition duration-200 sm:p-5
       ${
  issueState
    ? `${issueState.border} ${issueState.bg} ${issueState.hover}`
    : muted
      ? "border-[#d5dee2] bg-white opacity-55 grayscale-[0.2]"
      : highlight
        ? "border-[#055a7d]/30 bg-[#f0f7fa] hover:-translate-y-1 hover:border-[#055a7d]/45 hover:shadow-xl"
        : "border-[#d5dee2] bg-white hover:-translate-y-1 hover:border-[#055a7d]/25 hover:shadow-xl"
}`}
    >
      {!muted && (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#055a7d]/10 blur-2xl" />
        </div>
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div
  className={`flex h-14 w-14 items-center justify-center rounded-full border ring-1 ${
    issueState
      ? issueState.icon
      : "border-[#055a7d]/15 bg-[#055a7d]/15 text-[#055a7d] ring-[#055a7d]/10"
  }`}
>
          <span className="[&>svg]:h-7 [&>svg]:w-7">{icon}</span>
        </div>

        <span
  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${
    issueState
      ? issueState.badge
      : muted
        ? "bg-neutral-100 text-neutral-400"
        : "bg-[#055a7d]/8 text-[#055a7d]"
  }`}
>
  {label}
</span>
      </div>

      <h2 className="relative mt-6 text-2xl font-semibold tracking-[-0.03em] text-neutral-950">
        {title}
      </h2>

      <p className="relative mt-3 text-base leading-6 text-neutral-700">
        {text}
      </p>

      <div className="relative my-5 h-px bg-[#d5dee2]" />

      <p className="relative text-sm leading-6 text-neutral-500">{body}</p>

      <div className="relative mt-auto pt-6">
        <span
          className={`inline-flex items-center gap-1 text-sm font-bold ${
  issueState
    ? issueState.action
    : muted
      ? "text-neutral-400"
      : "text-[#055a7d] group-hover:text-[#042834]"
}`}
        >
          {action ?? "Kommer snart"}
          {action && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
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
  warning,
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  action: string;
  warning?: boolean;
}) {
  const card = (
    <div
      className={`group rounded-[26px] border bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
        warning
          ? "border-[#b58a14]/35 hover:border-[#b58a14]/60"
          : "border-[#d5dee2] hover:border-[#055a7d]/30"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ring-1 ${
            warning
              ? "border-[#b58a14]/25 bg-[#b58a14]/12 text-[#a77e04] ring-[#b58a14]/10"
              : "border-[#055a7d]/15 bg-[#055a7d]/15 text-[#055a7d] ring-[#055a7d]/10"
          }`}
        >
          <span className="[&>svg]:h-8 [&>svg]:w-8">{icon}</span>
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-neutral-950">
            {title}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
            {text}
          </p>
          <p
            className={`mt-3 inline-flex items-center gap-1 text-sm font-bold ${
              warning ? "text-[#9a7305]" : "text-[#055a7d]"
            } group-hover:text-[#042834]`}
          >
            {action}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </p>
        </div>
      </div>
    </div>
  );

  if (!href) return card;
  return <Link href={href}>{card}</Link>;
}