import { NextResponse } from "next/server";
import { requireViperApiActor } from "@/lib/viper/auth/access";
import { startViperPick } from "@/lib/viper/orders/repository";
import { isUuid } from "@/lib/viper/orders/validation";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireViperApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Ugyldig plukk" }, { status: 400 });
  }

  try {
    const result = await startViperPick(id, auth.actor, crypto.randomUUID());
    if (!result) {
      return NextResponse.json(
        { error: "Plukket er ikke tilgjengelig" },
        { status: 409 }
      );
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const conflict =
      message.includes("Another pilot pick") ||
      message.includes("not ready") ||
      message.includes("not assigned");

    console.error("Kunne ikke starte Viper-plukk", error);
    return NextResponse.json(
      {
        error: conflict
          ? "Et annet plukk er allerede aktivt"
          : "Kunne ikke starte plukket",
      },
      { status: conflict ? 409 : 500 }
    );
  }
}
