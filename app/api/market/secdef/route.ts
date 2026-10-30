import { NextResponse, type NextRequest } from "next/server";
import { DnseApiError } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";
import { loadSecdef } from "@/lib/dnse/secdef-cache";
import type { SecdefLimits } from "@/lib/dnse/normalize";
import { parseSymbol } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const boardId = (request.nextUrl.searchParams.get("boardId") ?? "G1").toUpperCase();
  const symbols = (request.nextUrl.searchParams.get("symbols") ?? request.nextUrl.searchParams.get("symbol") ?? "")
    .split(",")
    .map((item) => parseSymbol(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Thiếu mã. Dùng ?boardId=G1&symbols=VIC" }, { status: 400 });
  }

  const rows: SecdefLimits[] = [];
  let limited = false;
  for (const symbol of symbols) {
    try {
      rows.push(await loadSecdef(symbol, boardId));
    } catch (error) {
      if (error instanceof DnseApiError && error.status === 429) {
        limited = true;
        break;
      }
      return jsonError(error);
    }
  }

  return NextResponse.json({ boardId, rows, limited });
}
