import Link from "next/link";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import SnakeFooter from "@/app/components/SnakeFooter";
import SnakeNav from "@/app/components/SnakeNav";
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
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <header className="bg-[#05495b] px-5 py-6 text-white sm:px-8 sm:py-8">
            <Link
              href="/viper"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/70 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake til køen
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/55">
              Ordre
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {order.orderNumber}
            </h1>
            <p className="mt-2 text-sm text-white/65">
              {order.lines.length} linjer · {order.totalUnits} varer
            </p>
          </header>

          <div className="space-y-5 p-4 sm:p-8">
            {order.isOwnedByActor && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <CheckCircle2 className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-bold">Plukket er startet</p>
                  <p className="text-sm text-emerald-800/75">
                    Linjeplukk åpnes i neste fase.
                  </p>
                </div>
              </div>
            )}

            <section className="space-y-3">
              {order.lines.map((line) => (
                <article
                  key={line.id}
                  className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
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
                        <span className="text-2xl font-bold text-neutral-300">
                          {line.sequenceNumber}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold leading-tight">
                        {line.productName}
                      </p>
                      {line.variantName && (
                        <p className="mt-1 text-sm text-neutral-500">
                          {line.variantName}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                        <span className="rounded-full bg-neutral-100 px-3 py-1.5">
                          {line.sku ? `SKU ${line.sku}` : "Uten SKU"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#055a7d]/10 px-3 py-1.5 text-[#055a7d]">
                          <MapPin className="h-4 w-4" />
                          {line.locationCode}
                        </span>
                        <span className="rounded-full bg-[#b58a14]/10 px-3 py-1.5 text-[#8a6704]">
                          Antall {line.expectedQuantity}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {order.canStart && (
              <div className="sticky bottom-3 rounded-3xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur">
                <StartPickButton pickJobId={order.pickJobId} />
              </div>
            )}
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}
