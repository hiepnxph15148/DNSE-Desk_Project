import { NextResponse } from "next/server";
import { jsonError } from "@/lib/dnse/http";
import { loadIndexQuotes } from "@/lib/dnse/indices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await loadIndexQuotes();
    return NextResponse.json({ rows });
  } catch (error) {
    return jsonError(error);
  }
}
