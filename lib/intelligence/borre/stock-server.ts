import "server-only";
import { requireRole } from "@/lib/auth/require-role";
import { executeStockRead, type StockRequest } from "./stock-reader";

/** No public route/action and no service-role client. Existing session and RLS apply. */
export async function readBorreStock(request: StockRequest) {
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) throw new Error("BORRE_READ_FORBIDDEN");
  return executeStockRead({ authenticated: true, profile: auth.profile }, async (table, columns, from, to) => {
    const { data, count, error } = await auth.authClient.from(table).select(columns, { count: "exact" })
      .order("id").range(from, to);
    return { data, count, error };
  }, request);
}
