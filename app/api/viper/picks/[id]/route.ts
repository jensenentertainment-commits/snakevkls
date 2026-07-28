import { NextResponse } from "next/server";
import { requireViperApiActor } from "@/lib/viper/auth/access";
import { getActiveViperPick } from "@/lib/viper/picks/repository";
import { isUuid } from "@/lib/viper/orders/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireViperApiActor();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Ugyldig plukk" }, { status: 400 });
  const pick = await getActiveViperPick(id, auth.actor);
  if (!pick) return NextResponse.json({ error: "Plukket finnes ikke" }, { status: 404 });
  return NextResponse.json(pick, { headers: { "Cache-Control": "private, no-store" } });
}
