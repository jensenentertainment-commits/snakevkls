import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function verifyHmac(params: URLSearchParams, secret: string) {
  const hmac = params.get("hmac");
  if (!hmac) return false;

  const message = Array.from(params.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const code = params.get("code");
  const shop = params.get("shop");
  const state = params.get("state");

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const expectedState = request.cookies.get("shopify_oauth_state")?.value;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!code || !shop || !state) {
    return NextResponse.json({ error: "Mangler code/shop/state" }, { status: 400 });
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Mangler Shopify credentials" }, { status: 500 });
  }

  if (!expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Ugyldig OAuth state" }, { status: 400 });
  }

  if (!verifyHmac(params, clientSecret)) {
    return NextResponse.json({ error: "Ugyldig Shopify HMAC" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Mangler Supabase service key" }, { status: 500 });
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.json(
      { error: "Kunne ikke hente Shopify access token", details: tokenData },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabaseAdmin.from("shopify_connections").upsert(
    {
      shop,
      access_token: tokenData.access_token,
      scopes: tokenData.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop" }
  );

  if (error) {
    return NextResponse.json(
      { error: "Kunne ikke lagre Shopify token", details: error },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(new URL("/settings?shopify=connected", request.url));
  response.cookies.delete("shopify_oauth_state");
  return response;
}