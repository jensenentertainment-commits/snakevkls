import { notFound } from "next/navigation";
import ViperPickFlow from "@/app/components/viper/ViperPickFlow";
import { requireViperPageActor } from "@/lib/viper/auth/access";
import { isUuid } from "@/lib/viper/orders/validation";
import { getActiveViperPick } from "@/lib/viper/picks/repository";

export const dynamic = "force-dynamic";

export default async function ViperPickPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireViperPageActor();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const pick = await getActiveViperPick(id, actor);
  if (!pick) notFound();

  return (
    <>
      <div className="mx-auto min-w-0 [overflow-wrap:anywhere] max-w-xl">
        <ViperPickFlow initialPick={pick} />
      </div>
    </>
  );
}
