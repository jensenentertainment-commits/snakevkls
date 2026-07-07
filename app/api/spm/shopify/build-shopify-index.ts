"use server";

export async function buildShopifyIndex() {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/spm/shopify/build-index`,
    {
      method: "POST",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Kunne ikke bygge Shopify-index.");
  }

  return response.json();
}