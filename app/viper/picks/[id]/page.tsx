import { notFound } from "next/navigation";
import SnakeFooter from "@/app/components/SnakeFooter";
import SnakeNav from "@/app/components/SnakeNav";
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
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-xl px-3 py-3 sm:px-5">
        <SnakeNav />
        <ViperPickFlow initialPick={pick} />
        <SnakeFooter />
      </div>
    </main>
  );
}
