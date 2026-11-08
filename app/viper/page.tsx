import { Surface } from "@/app/components/design-system";
import Link from "next/link";
import { ArrowRight, ClipboardList, PackageCheck } from "lucide-react";
import { requireViperPageActor } from "@/lib/viper/auth/access";
import { getViperQueue } from "@/lib/viper/orders/repository";

export const dynamic = "force-dynamic";

function unitsLabel(count: number) {
  return `${count} ${count === 1 ? "vare" : "varer"}`;
}

export default async function ViperQueuePage() {
  const actor = await requireViperPageActor();
  const queue = await getViperQueue(actor);

  return (
    <>
      <div className="mx-auto min-w-0 [overflow-wrap:anywhere] max-w-5xl">
        {actor.role === "admin" && <Link className="mb-3 inline-flex min-h-11 items-center text-snake-text-on-dark underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark" href="/viper/admin/recovery">Gjenopprett avbrutte eller fastlåste plukk</Link>}

        <Surface as="section" variant="workspace" className="overflow-hidden">
          <header className="bg-snake-hero px-5 py-6 text-snake-text-on-dark sm:px-8 sm:py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-snake-text-on-dark-muted">
              Viper
            </p>
            <h1 className="mt-2 text-[length:var(--snake-text-display-page-mobile-size)] sm:text-[length:var(--snake-text-display-page-size)] font-semibold tracking-tight">
              Arbeidskø
            </h1>
            <p className="mt-2 text-sm text-snake-text-on-dark-muted">
              Velg neste ordre. Viper leder deg videre.
            </p>
          </header>

          <div className="space-y-6 px-4 py-5 sm:px-8 sm:py-8">
            {queue.activePick && (
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-snake-link">
                  Ditt aktive plukk
                </p>
                <Link
                  href={`/viper/picks/${queue.activePick.pickJobId}`}
                  className="flex min-h-24 items-center justify-between gap-4 rounded-snake-card border border-snake-border-selected bg-snake-surface-warm p-5 shadow-snake-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus transition hover:border-snake-brand"
                >
                  <div>
                    <p className="text-[length:var(--snake-text-heading-section-size)] font-semibold">
                      {queue.activePick.orderNumber}
                    </p>
                    <p className="mt-1 text-sm text-snake-text-secondary">
                      {queue.activePick.lineCount} linjer ·{" "}
                      {unitsLabel(queue.activePick.unitCount)}
                    </p>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-snake-pill bg-snake-brand text-snake-app-deep">
                    <ArrowRight className="h-6 w-6" />
                  </span>
                </Link>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-text-secondary">
                  Klar til plukk
                </p>
                <span className="rounded-snake-pill bg-snake-surface px-3 py-1 text-xs font-semibold text-snake-text-secondary">
                  {queue.readyOrders.length}
                </span>
              </div>

              {queue.readyOrders.length === 0 ? (
                <div className="rounded-snake-card border border-dashed border-snake-border-default bg-snake-surface px-5 py-10 text-center">
                  <PackageCheck className="mx-auto h-9 w-9 text-snake-text-muted" />
                  <p className="mt-3 font-semibold">Ingen ordre venter</p>
                  <p className="mt-1 text-sm text-snake-text-secondary">
                    Køen er tom akkurat nå.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.readyOrders.map((order) => (
                    <Link
                      key={order.pickJobId}
                      href={`/viper/orders/${order.orderId}`}
                      className="flex min-h-24 items-center justify-between gap-4 rounded-snake-card border border-snake-border-subtle bg-snake-surface p-5 shadow-snake-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus transition hover:border-snake-primary hover:shadow-snake-panel"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-snake-action bg-snake-info-surface text-snake-link">
                          <ClipboardList className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[length:var(--snake-text-heading-card-size)] font-semibold">
                            {order.orderNumber}
                          </p>
                          <p className="mt-1 text-sm text-snake-text-secondary">
                            {order.lineCount} linjer ·{" "}
                            {unitsLabel(order.unitCount)}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-snake-text-muted" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Surface>
      </div>
    </>
  );
}
