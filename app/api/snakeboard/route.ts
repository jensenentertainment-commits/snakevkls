import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

type MessageType = "info" | "important" | "issue";

type Body = {
  title: string;
  body?: string | null;
  type?: MessageType;
};

const allowedTypes: MessageType[] = ["info", "important", "issue"];

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createSupabaseAdminClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(["admin", "lager", "viewer"]);
const { searchParams } = new URL(request.url);

const limit = Number(searchParams.get("limit") ?? 50);

const safeLimit = Math.min(Math.max(limit, 1), 50);
  if (!auth.ok) return auth.response;

  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

 const { data, error } = await supabaseAdmin
  .from("snakeboard_messages")
  .select("*")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(safeLimit);
  
  if (error) {
    console.error("SnakeBoard fetch feilet", error);

    return NextResponse.json(
      { error: "Kunne ikke hente SnakeBoard" },
      { status: 500 }
    );
  }

  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(["admin", "lager", "viewer"]);

  if (!auth.ok) return auth.response;

  const { user, profile } = auth;

  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const messageBody = String(body.body ?? "").trim();
  const type = body.type ?? "info";

  if (!title) {
    return NextResponse.json({ error: "Mangler tittel" }, { status: 400 });
  }

  if (title.length > 120) {
    return NextResponse.json(
      { error: "Tittel kan maks være 120 tegn" },
      { status: 400 }
    );
  }

  if (messageBody.length > 1000) {
    return NextResponse.json(
      { error: "Beskjed kan maks være 1000 tegn" },
      { status: 400 }
    );
  }

  if (!allowedTypes.includes(type)) {
    return NextResponse.json({ error: "Ugyldig type" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Mangler env vars" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("snakeboard_messages")
    .insert({
      title,
      body: messageBody || null,
      type,
      status: "active",
      created_by: user.id,
      created_by_name: profile.display_name ?? user.email ?? null,
      
    })
    .select("*")
    .single();

  if (error) {
    console.error("SnakeBoard insert feilet", error);

    return NextResponse.json(
      { error: "Kunne ikke opprette beskjed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: data });
}