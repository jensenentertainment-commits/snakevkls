import { createClient } from "@/lib/supabase/client";

type ActivityEntityType =
  | "product"
  | "inventory"
  | "location"
  | "zone"
  | "stock_movement"
  | "shopify_sync"
  | "system";

export async function logActivity({
  entityType,
  entityId,
  action,
  title,
  description,
  metadata,
}: {
  entityType: ActivityEntityType;
  entityId?: string | null;
  action: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("activity_log").insert({
    entity_type: entityType,
    entity_id: entityId ?? null,
    action,
    title,
    description: description ?? null,
    metadata: metadata ?? null,
    actor_id: user?.id ?? null,
    actor_email: user?.email ?? null,
  });

  if (error) {
    console.error("Kunne ikke logge aktivitet:", error);
  }
}