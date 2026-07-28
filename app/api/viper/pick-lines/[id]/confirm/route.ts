import { NextResponse } from "next/server";
import { requireViperApiActor } from "@/lib/viper/auth/access";
import { confirmViperPickLine } from "@/lib/viper/picks/repository";
import { isUuid } from "@/lib/viper/orders/validation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireViperApiActor();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Ugyldig linje" }, { status: 400 });
  try {
    const result = await confirmViperPickLine(id, auth.actor, crypto.randomUUID());
    if (!result) return NextResponse.json({ error: "Linjen er ikke tilgjengelig" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: message.includes("open exception") ? "Linjen har et åpent avvik" : "Kunne ikke bekrefte linjen" },
      { status: message.includes("open exception") ? 409 : 500 }
    );
  }
}
