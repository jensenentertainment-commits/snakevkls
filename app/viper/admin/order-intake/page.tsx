import Link from "next/link";
import SnakeNav from "@/app/components/SnakeNav";
import ShopifyOrderPreviewForm from "@/app/components/viper/ShopifyOrderPreviewForm";
import { requireViperAdminPageActor } from "@/lib/viper/auth/access";
import { isViperShopifyImportEnabled } from "@/lib/viper/shopify/import-feature";

export const dynamic = "force-dynamic";

export default async function ShopifyOrderIntakePage() {
  await requireViperAdminPageActor();
  const importEnabled = isViperShopifyImportEnabled();

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <SnakeNav />
        <section className="rounded-[26px] bg-[#e8eef0] p-5 text-neutral-950 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#055a7d]">
            Viper · P4.1
          </p>
          <h1 className="mt-2 text-3xl font-black">Shopify-ordre</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Kontroller én ordre uten å lagre eller endre noe.
          </p>
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
            Mangler tilkoblingen ordretilgang?{" "}
            <Link href="/api/shopify/install" className="font-bold underline">
              Koble Shopify til på nytt
            </Link>
          </div>
          <div className="mt-5">
            <ShopifyOrderPreviewForm importEnabled={importEnabled} />
          </div>
        </section>
      </div>
    </main>
  );
}
