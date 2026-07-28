import Link from "next/link";
import { ArrowRight, ClipboardList, PackageCheck } from "lucide-react";
import SnakeFooter from "@/app/components/SnakeFooter";
import SnakeNav from "@/app/components/SnakeNav";
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
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <section className="overflow-hidden rounded-[26px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30 sm:rounded-[32px]">
          <header className="bg-[#05495b] px-5 py-7 text-white sm:px-8 sm:py-9">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">
              Viper
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Arbeidskø
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Velg neste ordre. Viper leder deg videre.
            </p>
          </header>

          <div className="space-y-7 px-4 py-5 sm:px-8 sm:py-8">
            {queue.activePick && (
              <section>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#055a7d]">
                  Ditt aktive plukk
                </p>
                <Link
                  href={`/viper/picks/${queue.activePick.pickJobId}`}
                  className="flex min-h-24 items-center justify-between gap-4 rounded-3xl border border-[#b58a14]/35 bg-[#fff8df] p-5 shadow-sm transition hover:border-[#b58a14]/60"
                >
                  <div>
                    <p className="text-2xl font-bold">
                      {queue.activePick.orderNumber}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {queue.activePick.lineCount} linjer ·{" "}
                      {unitsLabel(queue.activePick.unitCount)}
                    </p>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#b58a14] text-white">
                    <ArrowRight className="h-6 w-6" />
                  </span>
                </Link>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">
                  Klar til plukk
                </p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-600">
                  {queue.readyOrders.length}
                </span>
              </div>

              {queue.readyOrders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-neutral-300 bg-white/60 px-5 py-10 text-center">
                  <PackageCheck className="mx-auto h-9 w-9 text-neutral-400" />
                  <p className="mt-3 font-semibold">Ingen ordre venter</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Køen er tom akkurat nå.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.readyOrders.map((order) => (
                    <Link
                      key={order.pickJobId}
                      href={`/viper/orders/${order.orderId}`}
                      className="flex min-h-24 items-center justify-between gap-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-[#055a7d]/35 hover:shadow-md"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#055a7d]/10 text-[#055a7d]">
                          <ClipboardList className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xl font-bold">
                            {order.orderNumber}
                          </p>
                          <p className="mt-1 text-sm text-neutral-500">
                            {order.lineCount} linjer ·{" "}
                            {unitsLabel(order.unitCount)}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0 text-neutral-400" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>

        <SnakeFooter />
      </div>
    </main>
  );
}
