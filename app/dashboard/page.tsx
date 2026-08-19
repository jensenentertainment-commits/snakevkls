import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  FlaskConical,
  PackageCheck,
  Settings,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import { Card, StatusBadge } from "@/app/components/design-system";
import { isRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/auth";

type DashboardModule = {
  description: string;
  enabled: boolean;
  href?: string;
  icon: LucideIcon;
  id: string;
  roles: Role[];
  title: string;
};

const modules: readonly DashboardModule[] = [
  {
    description: "Produkter, lokasjoner og operativ lagerkontroll.",
    enabled: true,
    href: "/lager",
    icon: Boxes,
    id: "lager",
    roles: ["admin", "user", "warehouse", "lager"],
    title: "Lager",
  },
  {
    description: "Rask registrering av fysiske salg fra lageret.",
    enabled: true,
    href: "/warehouse-sales",
    icon: ShoppingBag,
    id: "lagersalg",
    roles: ["admin", "user", "lager"],
    title: "Lagersalg",
  },
  {
    description: "Arbeidskø og mobil arbeidsflyt for ordreplukk.",
    enabled: true,
    href: "/viper",
    icon: PackageCheck,
    id: "viper",
    roles: ["admin", "user", "warehouse", "lager"],
    title: "Viper",
  },
  {
    description: "Eksperimenter og administrative utviklingsverktøy.",
    enabled: true,
    href: "/labs",
    icon: FlaskConical,
    id: "labs",
    roles: ["admin"],
    title: "Snake Labs",
  },
  {
    description: "System, roller og administrativt oppsett.",
    enabled: true,
    href: "/settings",
    icon: Settings,
    id: "settings",
    roles: ["admin"],
    title: "Innstillinger",
  },
];

function getTimeOfDayText() {
  const hour = new Date().getHours();

  if (hour < 10) {
    return {
      greeting: "God morgen",
      welcome: "En ny arbeidsdag er klar i Snake.",
    };
  }

  if (hour < 14) {
    return {
      greeting: "God formiddag",
      welcome: "Velg arbeidsområdet du vil fortsette i.",
    };
  }

  if (hour < 18) {
    return {
      greeting: "God ettermiddag",
      welcome: "Her er inngangen til de aktive arbeidsområdene.",
    };
  }

  return {
    greeting: "God kveld",
    welcome: "Dagen nærmer seg slutten. Snake er fortsatt tilgjengelig.",
  };
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
    .select("display_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active || !isRole(profile.role)) {
    redirect("/login?error=access_denied");
  }

  const role: Role = profile.role;
  const fullName = profile.display_name || user.email || "bruker";
  return <DashboardContent fullName={fullName} role={role} />;
}

function DashboardContent({
  fullName,
  role,
}: {
  fullName: string;
  role: Role;
}) {
  const firstName = fullName.split(" ")[0];
  const { greeting, welcome } = getTimeOfDayText();
  const visibleModules = modules.filter((module) =>
    module.roles.includes(role),
  );

  return (
    <div className="space-y-[var(--snake-space-6)] lg:space-y-[var(--snake-space-8)]">
      <section className="overflow-hidden rounded-snake-panel border border-snake-border-on-dark-subtle bg-snake-app-elevated px-[var(--snake-space-5)] py-[var(--snake-space-6)] shadow-snake-panel sm:px-[var(--snake-space-8)] sm:py-[var(--snake-space-8)]">
        <p className="text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-eyebrow-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-on-dark-muted">
          Snake OS
        </p>
        <h1 className="mt-[var(--snake-space-3)] text-[length:var(--snake-text-display-page-mobile-size)] font-[var(--snake-font-weight-semibold)] leading-[var(--snake-text-display-page-mobile-line-height)] tracking-tight text-snake-text-on-dark sm:text-[length:var(--snake-text-display-page-size)] sm:leading-[var(--snake-text-display-page-line-height)]">
          {greeting}, {firstName}.
        </h1>
        <div className="mt-[var(--snake-space-4)] h-1 w-12 rounded-snake-pill bg-snake-brand" />
        <p className="mt-[var(--snake-space-4)] max-w-2xl text-[length:var(--snake-text-body-size)] leading-[var(--snake-text-body-line-height)] text-snake-text-on-dark-muted">
          {welcome}
        </p>
      </section>

      <section aria-labelledby="dashboard-modules">
        <div className="mb-[var(--snake-space-4)]">
          <p className="text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-eyebrow-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-on-dark-muted">
            Arbeidsområder
          </p>
          <h2
            className="mt-[var(--snake-space-2)] text-[length:var(--snake-text-heading-section-size)] font-[var(--snake-font-weight-semibold)] leading-[var(--snake-text-heading-section-line-height)] text-snake-text-on-dark"
            id="dashboard-modules"
          >
            Velg modul
          </h2>
        </div>

        <div className="grid gap-[var(--snake-space-4)] md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((module) => (
            <DashboardModuleCard key={module.id} module={module} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DashboardModuleCard({ module }: { module: DashboardModule }) {
  const Icon = module.icon;
  const content = (
    <Card
      className="flex min-h-52 h-full flex-col p-[var(--snake-space-5)]"
      variant={module.enabled ? "interactive" : "disabled"}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-snake-action border border-snake-info-border bg-snake-info-surface text-snake-info">
          <Icon aria-hidden="true" size={24} />
        </span>
        {!module.enabled ? (
          <StatusBadge label="Kommer snart" tone="neutral" />
        ) : null}
      </div>

      <h3 className="mt-[var(--snake-space-5)] text-[length:var(--snake-text-heading-card-size)] font-[var(--snake-font-weight-semibold)] leading-[var(--snake-text-heading-card-line-height)] text-snake-text-primary">
        {module.title}
      </h3>
      <p className="mt-[var(--snake-space-2)] text-[length:var(--snake-text-body-small-size)] leading-[var(--snake-text-body-small-line-height)] text-snake-text-secondary">
        {module.description}
      </p>

      {module.enabled ? (
        <span className="mt-auto inline-flex items-center gap-2 pt-[var(--snake-space-5)] text-[length:var(--snake-text-label-size)] font-[var(--snake-font-weight-semibold)] text-snake-link">
          Åpne
          <ArrowRight aria-hidden="true" size={16} />
        </span>
      ) : (
        <span className="mt-auto pt-[var(--snake-space-5)] text-[length:var(--snake-text-label-size)] font-[var(--snake-font-weight-semibold)] text-snake-text-disabled">
          Ikke tilgjengelig ennå
        </span>
      )}
    </Card>
  );

  if (!module.enabled || !module.href) {
    return (
      <div aria-disabled="true" data-module={module.id}>
        {content}
      </div>
    );
  }

  return (
    <Link
      className="block rounded-snake-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus focus-visible:ring-offset-2 focus-visible:ring-offset-snake-app"
      data-module={module.id}
      href={module.href}
    >
      {content}
    </Link>
  );
}
