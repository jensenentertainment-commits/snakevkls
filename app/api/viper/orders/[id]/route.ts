import { NextResponse } from "next/server";
import { requireViperApiActor } from "@/lib/viper/auth/access";
import { getViperOrderDetail } from "@/lib/viper/orders/repository";
import { isUuid } from "@/lib/viper/orders/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireViperApiActor();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Ugyldig ordre" }, { status: 400 });
  }

  try {
    const order = await getViperOrderDetail(id, auth.actor);
    if (!order) {
      return NextResponse.json(
        { error: "Ordren er ikke tilgjengelig" },
        { status: 404 }
      );
    }

    return NextResponse.json(order, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Kunne ikke hente Viper-ordre", error);
    return NextResponse.json(
      { error: "Kunne ikke hente ordren" },
      { status: 500 }
    );
  }
}
