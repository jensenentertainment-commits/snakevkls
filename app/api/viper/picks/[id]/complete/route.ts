import { NextResponse } from "next/server";
import { requireViperApiActor } from "@/lib/viper/auth/access";
import { completeViperPick } from "@/lib/viper/picks/repository";
import { isUuid } from "@/lib/viper/orders/validation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireViperApiActor();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Ugyldig plukk" }, { status: 400 });
  try {
    const result = await completeViperPick(id, auth.actor, crypto.randomUUID());
    if (!result) return NextResponse.json({ error: "Plukket er ikke tilgjengelig" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const conflict = /open exceptions|All pick lines|Insufficient inventory/.test(message);
    return NextResponse.json(
      { error: conflict ? "Plukket kan ikke fullføres ennå" : "Kunne ikke fullføre plukket" },
      { status: conflict ? 409 : 500 }
    );
  }
}
