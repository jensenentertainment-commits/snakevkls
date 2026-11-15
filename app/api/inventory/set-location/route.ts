import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
export async function POST() {
 const auth = await requireRole(["admin", "user", "warehouse"]);
 if (!auth.ok) return auth.response;
 return NextResponse.json({ error: "Denne flyten er pensjonert. Last siden på nytt og bruk produktvisningen." }, { status: 410 });
}
