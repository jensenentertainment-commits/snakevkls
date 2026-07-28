import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ViperActor } from "@/lib/viper/auth/access";
import {
  canReadViperPick,
  canStartViperPick,
} from "@/lib/viper/auth/resource-access";
import type {
  StartViperPickDto,
  ViperOrderDetailDto,
  ViperQueueDto,
  ViperQueueItemDto,
} from "./dto";

type QueueRow = {
  id: string;
  status: "ready" | "in_progress";
  assigned_to: string | null;
  started_at: string | null;
  orders: {
    id: string;
    order_number: string;
    received_at: string;
    order_lines: Array<{ requested_quantity: number }>;
  } | null;
};

type DetailRow = {
  id: string;
  status: "ready" | "in_progress";
  assigned_to: string | null;
  started_at: string | null;
  orders: {
    id: string;
    order_number: string;
    received_at: string;
  } | null;
  pick_lines: Array<{
    id: string;
    expected_quantity: number;
    sequence_number: number;
    order_lines: {
      sku: string | null;
      product_name: string;
      variant_name: string | null;
    } | null;
    products: { image_url: string | null } | null;
    locations: { code: string } | null;
  }>;
};

function queueItem(row: QueueRow): ViperQueueItemDto {
  if (!row.orders) throw new Error("Viper-oppdrag mangler ordre");

  return {
    orderId: row.orders.id,
    orderNumber: row.orders.order_number,
    receivedAt: row.orders.received_at,
    pickJobId: row.id,
    pickStatus: row.status,
    assignedTo: row.assigned_to,
    startedAt: row.started_at,
    lineCount: row.orders.order_lines.length,
    unitCount: row.orders.order_lines.reduce(
      (sum, line) => sum + line.requested_quantity,
      0
    ),
  };
}

export async function getViperQueue(actor: ViperActor): Promise<ViperQueueDto> {
  const { data, error } = await getSupabaseAdmin()
    .from("pick_jobs")
    .select(
      "id,status,assigned_to,started_at,orders!inner(id,order_number,received_at,order_lines(requested_quantity))"
    )
    .or(`status.eq.ready,and(status.eq.in_progress,assigned_to.eq.${actor.id})`)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Kunne ikke hente Viper-kø: ${error.message}`);

  const items = ((data ?? []) as unknown as QueueRow[]).map(queueItem);

  return {
    activePick:
      items.find(
        (item) =>
          item.pickStatus === "in_progress" && item.assignedTo === actor.id
      ) ?? null,
    readyOrders: items.filter((item) => item.pickStatus === "ready"),
  };
}

export async function getViperOrderDetail(
  orderId: string,
  actor: ViperActor
): Promise<ViperOrderDetailDto | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("pick_jobs")
    .select(
      "id,status,assigned_to,started_at,orders!inner(id,order_number,received_at),pick_lines(id,expected_quantity,sequence_number,order_lines(sku,product_name,variant_name),products(image_url),locations(code))"
    )
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) throw new Error(`Kunne ikke hente Viper-ordre: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const isOwnedByActor =
    row.status === "in_progress" && row.assigned_to === actor.id;

  if (
    !canReadViperPick(
      { status: row.status, assignedTo: row.assigned_to },
      actor.id
    )
  ) {
    return null;
  }
  if (!row.orders) throw new Error("Viper-oppdrag mangler ordre");

  const lines = row.pick_lines
    .toSorted((a, b) => a.sequence_number - b.sequence_number)
    .map((line) => {
      if (!line.order_lines || !line.locations) {
        throw new Error("Viper-plukklinje mangler vare eller lokasjon");
      }

      return {
        id: line.id,
        sku: line.order_lines.sku,
        productName: line.order_lines.product_name,
        variantName: line.order_lines.variant_name,
        imageUrl: line.products?.image_url ?? null,
        expectedQuantity: line.expected_quantity,
        locationCode: line.locations.code,
        sequenceNumber: line.sequence_number,
      };
    });

  return {
    orderId: row.orders.id,
    orderNumber: row.orders.order_number,
    receivedAt: row.orders.received_at,
    pickJobId: row.id,
    pickStatus: row.status,
    assignedTo: row.assigned_to,
    startedAt: row.started_at,
    totalUnits: lines.reduce((sum, line) => sum + line.expectedQuantity, 0),
    lines,
    canStart: row.status === "ready",
    isOwnedByActor,
  };
}

export async function startViperPick(
  pickJobId: string,
  actor: ViperActor,
  correlationId: string
): Promise<StartViperPickDto | null> {
  const supabase = getSupabaseAdmin();
  const { data: job, error: jobError } = await supabase
    .from("pick_jobs")
    .select("id,status,assigned_to")
    .eq("id", pickJobId)
    .maybeSingle();

  if (jobError) throw new Error(`Kunne ikke kontrollere plukk: ${jobError.message}`);
  if (!job) return null;

  const allowed = canStartViperPick(
    { status: job.status, assignedTo: job.assigned_to },
    actor.id
  );
  if (!allowed) return null;

  const { data, error } = await supabase.rpc("start_viper_pick", {
    requested_pick_job_id: pickJobId,
    requested_actor_id: actor.id,
    requested_actor_email: actor.email,
    requested_actor_name: actor.displayName,
    requested_correlation_id: correlationId,
  });

  if (error) throw new Error(error.message);
  return {
    orderId: String(data.orderId),
    pickJobId: String(data.pickJobId),
    status: "in_progress",
    startedAt: String(data.startedAt),
    idempotent: Boolean(data.idempotent),
  };
}
