import { NextResponse } from "next/server";
import { requireViperApiActor } from "@/lib/viper/auth/access";
import { reportViperPickException } from "@/lib/viper/picks/repository";
import { isUuid } from "@/lib/viper/orders/validation";
import { isViperPickExceptionType } from "@/lib/viper/picks/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireViperApiActor();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Ugyldig linje" }, { status: 400 });
  const body = await request.json().catch(() => null) as {
    exceptionType?: unknown; observedQuantity?: unknown; note?: unknown;
  } | null;
  if (!body || !isViperPickExceptionType(body.exceptionType)) {
    return NextResponse.json({ error: "Velg en gyldig avvikstype" }, { status: 400 });
  }
  const observedQuantity =
    body.observedQuantity === null || body.observedQuantity === undefined
      ? null : Number(body.observedQuantity);
  if (observedQuantity !== null && (!Number.isInteger(observedQuantity) || observedQuantity < 0)) {
    return NextResponse.json({ error: "Ugyldig antall" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  try {
    const result = await reportViperPickException(
      id, body.exceptionType, observedQuantity, note, auth.actor, crypto.randomUUID()
    );
    if (!result) return NextResponse.json({ error: "Linjen er ikke tilgjengelig" }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Kunne ikke registrere avviket" }, { status: 409 });
  }
}
