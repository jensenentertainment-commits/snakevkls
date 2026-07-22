import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function logServerActivity({
  entityType,
  entityId,
  action,
  title,
  description,
  metadata,
  actorEmail,
}: {
  entityType: string;
  entityId?: string | null;
  action: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  actorEmail?: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("activity_log").insert({
    entity_type: entityType,
    entity_id: entityId ?? null,
    action,
    title,
    description: description ?? null,
    metadata: metadata ?? null,
    actor_email: actorEmail ?? null,
  });

  if (error) {
    console.error("Kunne ikke logge server-activity:", error);
  }
}
