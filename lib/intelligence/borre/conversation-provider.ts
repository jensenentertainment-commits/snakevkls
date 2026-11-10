import "server-only";
import { requireRole } from "@/lib/auth/require-role";
import type { ContextProvider } from "../workforce/context-provider";
import { resolveBorreRoute } from "./conversation-route";
import { readConversationData } from "./conversation-data";
import { buildBorreAnswer, type BorreConversationContext } from "./conversation-answer";

export const borreConversationProvider = {
  id: "warehouse.summary", capabilityId: "warehouse.read_summary",
  async provide(context, input) {
    const auth = await requireRole(["admin", "user", "warehouse"]);
    if (!auth.ok || auth.user.id !== context.userId || auth.profile.role !== context.userRole) throw new Error("BORRE_READ_FORBIDDEN");
    const route = resolveBorreRoute(input);
    const data = route.target ? await readConversationData(route.target, async (table, columns, from, to, filter) => {
      let query = auth.authClient.from(table).select(columns, { count: "exact" }).order("id");
      if (filter?.op === "in") query = query.in(filter.column, filter.value as string[]);
      else if (filter?.op === "ilike") query = query.ilike(filter.column, filter.value as string);
      else if (filter) query = query.eq(filter.column, filter.value as string);
      const { data, count, error } = await query.range(from, to);
      return { data, count, error };
    }) : null;
    const readAt = new Date().toISOString();
    return { route, answer: buildBorreAnswer(route, data, readAt), readAt: data ? readAt : null };
  },
} satisfies ContextProvider<BorreConversationContext>;
