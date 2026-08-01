import { SaleDocument } from "@/app/components/warehouse-sales";

export default async function WarehouseSaleDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SaleDocument id={id} />;
}
