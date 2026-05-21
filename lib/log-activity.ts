

type LogActivityInput = {
  entityType?: string | null;
  entityId?: string | null;
  action: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
};

export async function logActivity(
  supabaseAdmin: any,
  input: LogActivityInput
) {
  const { error } = await supabaseAdmin.from("activity_log").insert({
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    action: input.action,
    title: input.title,
    description: input.description ?? null,
    metadata: input.metadata ?? {},
    actor_id: input.actorId ?? null,
    actor_email: input.actorEmail ?? null,
    actor_name: input.actorName ?? null,
  });

  if (error) {
    console.error("Activity logging failed", error);
  }
}