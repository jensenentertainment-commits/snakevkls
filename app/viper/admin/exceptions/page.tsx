import SnakeNav from "@/app/components/SnakeNav";
import ResolveViperException from "@/app/components/viper/ResolveViperException";
import { requireViperAdminPageActor } from "@/lib/viper/auth/access";
import { getOpenViperExceptions } from "@/lib/viper/picks/repository";

export const dynamic = "force-dynamic";

export default async function ViperExceptionsPage() {
  await requireViperAdminPageActor();
  const exceptions = await getOpenViperExceptions();
  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <SnakeNav />
        <section className="rounded-[26px] bg-[#e8eef0] p-5 text-neutral-950">
          <h1 className="text-2xl font-bold">Åpne Viper-avvik</h1>
          <p className="mt-1 text-sm text-neutral-600">Kun kontrollflate for P3.</p>
          <div className="mt-5 space-y-4">
            {exceptions.length === 0 && <p className="rounded-2xl bg-white p-5">Ingen åpne avvik.</p>}
            {exceptions.map((item) => (
              <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="font-black">{item.orderNumber} · linje {item.sequenceNumber}</p>
                <p className="mt-1 text-lg font-bold">{item.productName}</p>
                <p className="text-sm text-neutral-500">{item.sku ?? "Uten SKU"}</p>
                <p className="mt-3 font-semibold">{exceptionLabels[item.exceptionType]}</p>
                {item.note && <p className="mt-1 text-sm">{item.note}</p>}
                <ResolveViperException exceptionId={item.id} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const exceptionLabels = {
  item_not_found: "Varen finnes ikke",
  wrong_quantity: "Feil antall",
  damaged: "Varen er skadet",
};
