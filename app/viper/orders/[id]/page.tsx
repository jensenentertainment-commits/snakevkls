import { Surface, Card } from "@/app/components/design-system";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import StartPickButton from "@/app/components/viper/StartPickButton";
import { requireViperPageActor } from "@/lib/viper/auth/access";
import { getViperOrderDetail } from "@/lib/viper/orders/repository";
import { isUuid } from "@/lib/viper/orders/validation";

export const dynamic = "force-dynamic";

export default async function ViperOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireViperPageActor();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const order = await getViperOrderDetail(id, actor);
  if (!order) notFound();

  return (
    <>
      <div className="mx-auto min-w-0 [overflow-wrap:anywhere] max-w-4xl">

        <Surface as="section" variant="workspace" className="overflow-hidden">
          <header className="bg-snake-hero px-5 py-6 text-snake-text-on-dark sm:px-8 sm:py-8">
            <Link
              href="/viper"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-snake-text-on-dark-muted hover:text-snake-text-on-dark"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake til køen
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-snake-text-on-dark-muted">
              Ordre
            </p>
            <h1 className="mt-1 text-[length:var(--snake-text-display-page-mobile-size)] sm:text-[length:var(--snake-text-display-page-size)] font-semibold tracking-tight">
              {order.orderNumber}
            </h1>
            <p className="mt-2 text-sm text-snake-text-on-dark-muted">
              {order.lines.length} linjer · {order.totalUnits} varer
            </p>
          </header>

          <div className="space-y-5 p-4 sm:p-8">
            {order.isOwnedByActor && (
              <div className="flex items-center gap-3 rounded-snake-action border border-snake-success-border bg-snake-success-surface p-4 text-snake-success">
                <CheckCircle2 className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-semibold">Plukket er startet</p>
                  <p className="text-sm text-snake-success">
                    Du finner det aktive plukket i arbeidskøen.
                  </p>
                </div>
              </div>
            )}

            <section className="space-y-3">
              {order.lines.map((line) => (
                <Card as="article"
                  key={line.id}
                  className="min-w-0"
                >
                  <div className="flex gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-snake-action bg-snake-surface-subtle">
                      {line.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={line.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </>
                      ) : (
                        <span className="text-[length:var(--snake-text-heading-section-size)] font-semibold text-snake-text-muted">
                          {line.sequenceNumber}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold leading-tight">
                        {line.productName}
                      </p>
                      {line.variantName && (
                        <p className="mt-1 text-sm text-snake-text-secondary">
                          {line.variantName}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                        <span className="rounded-snake-pill bg-snake-surface-subtle px-3 py-1.5">
                          {line.sku ? `SKU ${line.sku}` : "Uten SKU"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-snake-pill bg-snake-info-surface px-3 py-1.5 text-snake-link">
                          <MapPin className="h-4 w-4" />
                          {line.locationCode}
                        </span>
                        <span className="rounded-snake-pill bg-snake-brand-soft px-3 py-1.5 text-snake-warning">
                          Antall {line.expectedQuantity}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </section>

            {order.canStart && (
              <div className="sticky bottom-3 rounded-snake-card border border-snake-border-subtle bg-snake-surface/95 p-4 shadow-snake-panel backdrop-blur">
                <StartPickButton pickJobId={order.pickJobId} version={order.version} />
              </div>
            )}
          </div>
        </Surface>
      </div>
    </>
  );
}
