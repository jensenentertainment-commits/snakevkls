import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ViperActor } from "@/lib/viper/auth/access";
import type {
  ViperActivePickDto,
  ViperOpenExceptionDto,
  ViperPickExceptionType,
} from "./dto";

type PickRow = {
  id: string;
  status: "in_progress" | "completed";
  assigned_to: string | null;
  orders: { id: string; order_number: string } | null;
  pick_lines: Array<{
    id: string;
    sequence_number: number;
    status: "pending" | "picked" | "cancelled";
    expected_quantity: number;
    picked_at: string | null;
    order_lines: {
      product_name: string;
      variant_name: string | null;
      sku: string | null;
    } | null;
    products: { image_url: string | null } | null;
    locations: { code: string } | null;
    pick_exceptions: Array<{ id: string; status: string }>;
  }>;
};

export async function getActiveViperPick(
  pickJobId: string,
  actor: ViperActor
): Promise<ViperActivePickDto | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("pick_jobs")
    .select(
      "id,status,assigned_to,orders!inner(id,order_number),pick_lines(id,sequence_number,status,expected_quantity,picked_at,order_lines(product_name,variant_name,sku),products(image_url),locations(code),pick_exceptions(id,status))"
    )
    .eq("id", pickJobId)
    .maybeSingle();
  if (error) throw new Error(`Kunne ikke hente plukket: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as PickRow;
  if (row.assigned_to !== actor.id || !["in_progress", "completed"].includes(row.status)) {
    return null;
  }
  if (!row.orders) throw new Error("Plukket mangler ordre");

  const lines = row.pick_lines
    .toSorted((a, b) => a.sequence_number - b.sequence_number)
    .map((line) => {
      if (!line.order_lines || !line.locations) {
        throw new Error("Plukklinjen mangler vare eller lokasjon");
      }
      return {
        id: line.id,
        sequenceNumber: line.sequence_number,
        status: line.status,
        productName: line.order_lines.product_name,
        variantName: line.order_lines.variant_name,
        sku: line.order_lines.sku,
        imageUrl: line.products?.image_url ?? null,
        locationCode: line.locations.code,
        expectedQuantity: line.expected_quantity,
        pickedAt: line.picked_at,
        hasOpenException: line.pick_exceptions.some((item) => item.status === "open"),
      };
    });

  return {
    pickJobId: row.id,
    orderId: row.orders.id,
    orderNumber: row.orders.order_number,
    status: row.status,
    totalLines: lines.length,
    completedLines: lines.filter((line) => line.status === "picked").length,
    hasOpenExceptions: lines.some((line) => line.hasOpenException),
    lines,
  };
}

async function assertOwnedActivePickLine(pickLineId: string, actorId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("pick_lines")
    .select("id,pick_jobs!inner(status,assigned_to)")
    .eq("id", pickLineId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const job = data?.pick_jobs as unknown as { status: string; assigned_to: string } | null;
  return Boolean(data && job?.status === "in_progress" && job.assigned_to === actorId);
}

export async function confirmViperPickLine(
  pickLineId: string,
  actor: ViperActor,
  correlationId: string
) {
  if (!(await assertOwnedActivePickLine(pickLineId, actor.id))) return null;
  const { data, error } = await getSupabaseAdmin().rpc("confirm_viper_pick_line", {
    requested_pick_line_id: pickLineId,
    requested_actor_id: actor.id,
    requested_correlation_id: correlationId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function reportViperPickException(
  pickLineId: string,
  exceptionType: ViperPickExceptionType,
  observedQuantity: number | null,
  note: string | null,
  actor: ViperActor,
  correlationId: string
) {
  if (!(await assertOwnedActivePickLine(pickLineId, actor.id))) return null;
  const { data, error } = await getSupabaseAdmin().rpc("report_viper_pick_exception", {
    requested_pick_line_id: pickLineId,
    requested_exception_type: exceptionType,
    requested_observed_quantity: observedQuantity,
    requested_note: note,
    requested_actor_id: actor.id,
    requested_actor_email: actor.email,
    requested_actor_name: actor.displayName,
    requested_correlation_id: correlationId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function completeViperPick(
  pickJobId: string,
  actor: ViperActor,
  correlationId: string
) {
  const pick = await getActiveViperPick(pickJobId, actor);
  if (!pick) return null;
  const { data, error } = await getSupabaseAdmin().rpc("complete_viper_pick", {
    requested_pick_job_id: pickJobId,
    requested_actor_id: actor.id,
    requested_actor_email: actor.email,
    requested_actor_name: actor.displayName,
    requested_correlation_id: correlationId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOpenViperExceptions(): Promise<ViperOpenExceptionDto[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("pick_exceptions")
    .select(
      "id,exception_type,note,observed_quantity,reported_at,pick_line_id,pick_lines!inner(sequence_number,order_lines!inner(product_name,sku),pick_jobs!inner(orders!inner(order_number)))"
    )
    .eq("status", "open")
    .order("reported_at", { ascending: true });
  if (error) throw new Error(`Kunne ikke hente avvik: ${error.message}`);
  return (data ?? []).map((raw) => {
    const row = raw as unknown as {
      id: string; exception_type: ViperPickExceptionType; note: string | null;
      observed_quantity: number | null; reported_at: string; pick_line_id: string;
      pick_lines: { sequence_number: number; order_lines: { product_name: string; sku: string | null };
        pick_jobs: { orders: { order_number: string } } };
    };
    return {
      id: row.id, exceptionType: row.exception_type, note: row.note,
      observedQuantity: row.observed_quantity, reportedAt: row.reported_at,
      pickLineId: row.pick_line_id, sequenceNumber: row.pick_lines.sequence_number,
      orderNumber: row.pick_lines.pick_jobs.orders.order_number,
      productName: row.pick_lines.order_lines.product_name,
      sku: row.pick_lines.order_lines.sku,
    };
  });
}

export async function resolveViperPickException(
  exceptionId: string,
  resolutionNote: string,
  actor: ViperActor,
  correlationId: string
) {
  const { data, error } = await getSupabaseAdmin().rpc("resolve_viper_pick_exception", {
    requested_exception_id: exceptionId,
    requested_resolution_note: resolutionNote,
    requested_actor_id: actor.id,
    requested_actor_email: actor.email,
    requested_actor_name: actor.displayName,
    requested_correlation_id: correlationId,
  });
  if (error) throw new Error(error.message);
  return data;
}
