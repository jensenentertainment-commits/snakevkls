import { redirect } from "next/navigation";
import { readWarehouseOverview } from "@/lib/warehouse-overview/read";
import { WarehouseOverview } from "./WarehouseOverview";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const result = await readWarehouseOverview();
  if (!result.ok) redirect(result.status === 401 ? "/login?next=/lager" : "/login?error=access_denied");
  return <WarehouseOverview data={result.data} />;
}
