import Link from "next/link";
import { connection } from "next/server";
import {
  Search,
  MapPin,
  AlertTriangle,
  PackageCheck,
  Boxes,
  MessageCircleCheckIcon,
  ScanLine,
  Activity,
  ArrowRight,
  Wrench,
} from "lucide-react";
import SnakeIntelligencePanel from "../components/SnakeIntelligencePanel";
import SystemPulseBar from "../components/dashboard/SystemPulseBar";
import SnakeBoardPreview from "../components/SnakeBoardPreview";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";
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
  await connection();

  const {
  missingLocationCount,
  missingSkuCount,
  emptyLocationCount,
  quantityDiffCount,
  placedProductCount,
  activeProductCount,
  locationsNoZoneCount,
} = await getDashboardStats();
  const issueCount =
  missingLocationCount + missingSkuCount + emptyLocationCount;


const hasIssues = issueCount > 0;
const issueState: IssueCardState = hasIssues
  ? {
      border: "border-snake-danger-border",
      bg: "bg-snake-danger-surface",
      badge: "bg-snake-danger-surface text-snake-danger",
      icon: "border-snake-danger-border bg-snake-danger-surface text-snake-danger ring-snake-danger-border",
      action: "text-snake-danger",
      hover: "hover:border-snake-danger-border hover:shadow-snake-panel",
    }
  : {
      border: "border-snake-success-border",
      bg: "bg-snake-success-surface",
      badge: "bg-snake-success-surface text-snake-success",
      icon: "border-snake-success-border bg-snake-success-surface text-snake-success ring-snake-success-border",
      action: "text-snake-success",
      hover: "hover:border-snake-success-border hover:shadow-snake-panel",
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


  const health = getWarehouseHealth({
  missingLocationCount,
  quantityDiffCount,
  locationsWithoutZoneCount: locationsNoZoneCount,
  placedCount: placedProductCount,
});

  return (
  <>
<SystemPulseBar
  activeProducts={activeProductCount}
  emptyLocations={0}
  snakeHealth={health.score}
  lastSyncOk
/>
      <section className="overflow-hidden rounded-snake-panel bg-snake-workspace text-snake-text-primary shadow-snake-overlay">
        <div className="relative overflow-hidden bg-snake-hero text-snake-text-on-dark">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-snake-info/15 blur-3xl" />
          

          <div className="relative grid gap-8 px-8 py-10 sm:px-10 xl:px-12 lg:grid-cols-[minmax(0,1.35fr)_420px] lg:items-start">
          
  <SnakeIntelligencePanel
  missingLocationCount={missingLocationCount}
  quantityDiffCount={quantityDiffCount}
  locationsWithoutZoneCount={locationsNoZoneCount}
  placedCount={placedProductCount}
/>

        <SnakeBoardPreview />

      
          </div>
        </div>
 
        <div className="px-5 py-7 sm:px-8 sm:py-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-snake-link/70">
                Moduler
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-snake-text-primary">
                Arbeidsflate
              </h2>
            </div>

            <p className="max-w-xl text-sm leading-6 text-snake-text-secondary">
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
              href="/location-count"
              icon={<ScanLine />}
              title="Lokasjonstelling"
              text="Tell innhold på en lokasjon og registrer avvik uten å endre lager automatisk."
              action="Start Telling"
            />

             <WideCard
               variant="live"
              href="/snakeboard"
              icon={<MessageCircleCheckIcon />}
              title="Snakeboard"
              text="Beskjeder til lageret."
              action="Åpne Snakeboard"
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
  </>
);



 



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
      className={`group relative flex h-full min-h-[310px] flex-col overflow-hidden rounded-snake-card border p-5 shadow-snake-card transition duration-200 sm:p-5
       ${
  issueState
    ? `${issueState.border} ${issueState.bg} ${issueState.hover}`
    : muted
      ? "border-snake-border-default bg-snake-surface opacity-55 grayscale-[0.2]"
      : highlight
        ? "border-snake-primary/30 bg-snake-info-surface hover:-translate-y-1 hover:border-snake-primary/45 hover:shadow-snake-panel"
        : "border-snake-border-default bg-snake-surface hover:-translate-y-1 hover:border-snake-primary/25 hover:shadow-snake-panel"
}`}
    >
      {!muted && (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-snake-primary/10 blur-2xl" />
        </div>
      )}

      <div className="relative flex items-start justify-between gap-4">
        <div
  className={`flex h-14 w-14 items-center justify-center rounded-full border ring-1 ${
    issueState
      ? issueState.icon
  
  : "border-snake-primary/15 bg-snake-primary/15 text-snake-link ring-snake-primary/10"
  }`}
>
          <span className="[&>svg]:h-7 [&>svg]:w-7">{icon}</span>
        </div>

        <span
  className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${
    issueState
      ? issueState.badge
      : muted
        ? "bg-snake-neutral-surface text-snake-text-disabled"
        : "bg-snake-primary/8 text-snake-link"
  }`}
>
  {label}
</span>
      </div>

      <h2 className="relative mt-6 text-2xl font-semibold tracking-[-0.03em] text-snake-text-primary">
        {title}
      </h2>

      <p className="relative mt-3 text-base leading-6 text-snake-text-secondary">
        {text}
      </p>

      <div className="relative my-5 h-px bg-snake-border-default" />

      <p className="relative text-sm leading-6 text-snake-text-muted">{body}</p>

      <div className="relative mt-auto pt-6">
        <span
          className={`inline-flex items-center gap-1 text-sm font-bold ${
  issueState
    ? issueState.action
    : muted
      ? "text-snake-text-disabled"
      : "text-snake-link group-hover:text-snake-text-primary"
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
   variant = "default",
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  action: string;
  warning?: boolean;
  variant?: "default" | "live";
  
}) {
  const card = (
    <div
      className={`group rounded-snake-card border bg-snake-surface p-6 shadow-snake-card transition duration-200 hover:-translate-y-0.5 hover:shadow-snake-panel ${
        warning
          ? "border-snake-brand/35 hover:border-snake-brand/60"
          : variant === "live"
  ? "border-snake-info-border/25 hover:border-snake-info/45"
  : "border-snake-border-default hover:border-snake-primary/30"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ring-1 ${
            warning
              ? "border-snake-brand/25 bg-snake-brand/12 text-snake-brand-strong ring-snake-brand/10"
              : "border-snake-primary/15 bg-snake-primary/15 text-snake-link ring-snake-primary/10"
          }`}
        >
          <span className="[&>svg]:h-8 [&>svg]:w-8">{icon}</span>
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-snake-text-primary">
            {title}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-snake-text-secondary">
            {text}
          </p>
          <p
            className={`mt-3 inline-flex items-center gap-1 text-sm font-bold ${
              warning
  ? "text-snake-brand-strong"
  : variant === "live"
    ? "text-snake-info"
    : "text-snake-link"
            } group-hover:text-snake-text-primary`}
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
}
