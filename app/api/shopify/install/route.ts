import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const scopes = process.env.SHOPIFY_SCOPES ?? "read_products,read_inventory";
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;

  if (!shop || !clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Mangler Shopify env vars" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());

  response.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}