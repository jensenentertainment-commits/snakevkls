import { NextResponse } from "next/server";
import { requireViperAdminApiActor } from "@/lib/viper/auth/access";
import { resolveViperPickException } from "@/lib/viper/picks/repository";
import { isUuid } from "@/lib/viper/orders/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireViperAdminApiActor();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Ugyldig avvik" }, { status: 400 });
  const body = await request.json().catch(() => null) as { resolutionNote?: unknown } | null;
  const note = typeof body?.resolutionNote === "string" ? body.resolutionNote.trim() : "";
  if (!note) return NextResponse.json({ error: "Forklaring er påkrevd" }, { status: 400 });
  try {
    return NextResponse.json(
      await resolveViperPickException(id, note.slice(0, 1000), auth.actor, crypto.randomUUID())
    );
  } catch {
    return NextResponse.json({ error: "Kunne ikke løse avviket" }, { status: 409 });
  }
}
