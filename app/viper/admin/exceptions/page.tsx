import { Surface, Card } from "@/app/components/design-system";
import Link from "next/link";
import ResolveViperException from "@/app/components/viper/ResolveViperException";
import { requireViperAdminPageActor } from "@/lib/viper/auth/access";
import { getOpenViperExceptions } from "@/lib/viper/picks/repository";

export const dynamic = "force-dynamic";

export default async function ViperExceptionsPage() {
  await requireViperAdminPageActor();
  const exceptions = await getOpenViperExceptions();
  return (
    <>
      <div className="mx-auto min-w-0 [overflow-wrap:anywhere] max-w-3xl">
        <Surface as="section" variant="workspace" className="p-4 sm:p-6 lg:p-8">
          <h1 className="text-[length:var(--snake-text-heading-section-size)] font-semibold">Åpne Viper-avvik</h1>
          <p className="mt-1 text-sm text-snake-text-secondary">Kontroller og løs registrerte plukkavvik.</p>
          <Link href="/viper/admin/recovery" className="inline-flex min-h-11 items-center text-snake-link underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus">Avbrutte og fastlåste plukk</Link>
          <div className="mt-5 space-y-4">
            {exceptions.length === 0 && <p className="rounded-snake-action bg-snake-surface p-5">Ingen åpne avvik.</p>}
            {exceptions.map((item) => (
              <Card as="article" key={item.id} className="min-w-0">
                <p className="font-semibold">{item.orderNumber} · linje {item.sequenceNumber}</p>
                <p className="mt-1 text-lg font-semibold">{item.productName}</p>
                <p className="text-sm text-snake-text-secondary">{item.sku ?? "Uten SKU"}</p>
                <p className="mt-3 font-semibold">{exceptionLabels[item.exceptionType]}</p>
                {item.note && <p className="mt-1 text-sm">{item.note}</p>}
                <ResolveViperException exceptionId={item.id} version={item.version} />
              </Card>
            ))}
          </div>
        </Surface>
      </div>
    </>
  );
}

const exceptionLabels = {
  item_not_found: "Varen finnes ikke",
  wrong_quantity: "Feil antall",
  damaged: "Varen er skadet",
};
