import { Surface } from "@/app/components/design-system";
import Link from "next/link";
import ShopifyOrderPreviewForm from "@/app/components/viper/ShopifyOrderPreviewForm";
import { requireViperAdminPageActor } from "@/lib/viper/auth/access";
import { isViperShopifyImportEnabled } from "@/lib/viper/shopify/import-feature";

export const dynamic = "force-dynamic";

export default async function ShopifyOrderIntakePage() {
  await requireViperAdminPageActor();
  const importEnabled = isViperShopifyImportEnabled();

  return (
    <>
      <div className="mx-auto min-w-0 [overflow-wrap:anywhere] max-w-3xl">
        <Surface as="section" variant="workspace" className="p-4 sm:p-6 lg:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-snake-link">
            Viper · Ordreimport
          </p>
          <h1 className="mt-2 text-[length:var(--snake-text-display-page-mobile-size)] sm:text-[length:var(--snake-text-display-page-size)] font-semibold">Shopify-ordre</h1>
          <p className="mt-2 text-sm text-snake-text-secondary">
            Forhåndsvis en Shopify-ordre og kontroller plukkgrunnlaget før import.
          </p>
          <div className="mt-5 rounded-snake-action border border-snake-info-border bg-snake-info-surface p-4 text-sm">
            Mangler tilkoblingen ordretilgang?{" "}
            <Link href="/api/shopify/install" className="font-semibold underline">
              Koble Shopify til på nytt
            </Link>
          </div>
          <div className="mt-5">
            <ShopifyOrderPreviewForm importEnabled={importEnabled} />
          </div>
        </Surface>
      </div>
    </>
  );
}
