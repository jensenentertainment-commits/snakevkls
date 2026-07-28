import { NextResponse } from "next/server";
import { requireViperApiActor } from "@/lib/viper/auth/access";
import { getViperQueue } from "@/lib/viper/orders/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireViperApiActor();
  if (!auth.ok) return auth.response;

  try {
    const queue = await getViperQueue(auth.actor);
    return NextResponse.json(queue, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Kunne ikke hente Viper-kø", error);
    return NextResponse.json(
      { error: "Kunne ikke hente arbeidskøen" },
      { status: 500 }
    );
  }
}
