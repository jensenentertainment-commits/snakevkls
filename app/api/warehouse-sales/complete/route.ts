import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  completeWarehouseSale,
  WarehouseSaleCompletionError,
} from "@/lib/warehouse-sales/completion";
import {
  getWarehouseSale,
  quoteWarehouseSale,
} from "@/lib/warehouse-sales/repository";
import {
  normalizeWarehouseSaleRequest,
  WarehouseSaleValidationError,
} from "@/lib/warehouse-sales/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "user", "lager"]);
  if (!auth.ok) return auth.response;

  const shop = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!shop) {
    return NextResponse.json(
      { error: "Shopify-butikken er ikke konfigurert" },
      { status: 503 }
    );
  }

  try {
    const input = normalizeWarehouseSaleRequest(await request.json());
    const quote = await quoteWarehouseSale(auth.authClient, input.lines);
    if (!quote.canComplete) {
      const inventoryChanged = quote.lines.some(
        (line) => line.error?.startsWith("Kun ") || line.error === "Ikke på lager",
      );
      const productUnavailable = quote.lines.some(
        (line) =>
          line.error === "Produktet er ikke lenger tilgjengelig" ||
          line.error === "Ikke koblet til riktig lager" ||
          line.error === "Lagerkoblingen er ikke klar",
      );
      return NextResponse.json(
        {
          error: inventoryChanged
            ? "Beholdningen har endret seg. Kontroller kurven på nytt."
            : "En eller flere varer kan ikke lenger selges.",
          failureKind: inventoryChanged
            ? "inventory_changed"
            : productUnavailable
              ? "product_unavailable"
              : "rejected",
          quote,
        },
        { status: 409 },
      );
    }

    const result = await completeWarehouseSale(
      input,
      {
        id: auth.user.id,
        email: auth.user.email ?? null,
        name:
          auth.profile.display_name?.trim() ||
          auth.user.email ||
          "Ukjent bruker",
      },
      shop
    );

    const sale = await getWarehouseSale(auth.authClient, result.saleId);
    if (!sale) {
      throw new WarehouseSaleCompletionError(
        "Det fullførte salget kunne ikke leses tilbake",
        "INTERNAL",
      );
    }

    return NextResponse.json(
      { ok: true, sale, shopifySyncStatus: result.shopifySyncStatus },
      { status: result.idempotentReplay ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof WarehouseSaleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof WarehouseSaleCompletionError) {
      const status =
        error.code === "IDEMPOTENCY_CONFLICT" ||
        error.code === "INSUFFICIENT_INVENTORY"
          ? 409
          : error.code === "INVALID_SALE"
            ? 400
            : error.code === "SHOPIFY_NOT_READY"
              ? 503
              : 500;

      if (status === 500) {
        console.error("Kunne ikke fullføre lagersalg", error);
      }

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          failureKind:
            error.code === "INSUFFICIENT_INVENTORY"
              ? "inventory_changed"
              : error.code === "INVALID_SALE"
                ? "product_unavailable"
                : error.code === "INTERNAL"
                  ? "unknown"
                  : "rejected",
        },
        { status }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
    }

    console.error("Uventet feil ved fullføring av lagersalg", error);
    return NextResponse.json(
      {
        error:
          "Resultatet er ukjent. Prøv igjen – Snake bruker samme salg og registrerer det ikke dobbelt.",
        failureKind: "unknown",
      },
      { status: 500 }
    );
  }
}
