import type { NextRequest } from "next/server";
import { handleCountCommand } from "@/lib/inventory/count-handler";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) { return handleCountCommand(request, "complete"); }
