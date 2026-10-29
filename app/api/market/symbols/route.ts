import { NextResponse } from "next/server";
import { loadCatalog } from "@/lib/dnse/catalog";
import { jsonError } from "@/lib/dnse/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const symbols = await loadCatalog();
    return NextResponse.json({ symbols });
  } catch (error) {
    return jsonError(error);
  }
}
