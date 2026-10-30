import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/dnse/http";
import { fetchSessionTape } from "@/lib/dnse/fetch-session-tape";
import { parseSymbol } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const symbol = parseSymbol(request.nextUrl.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "Mã chứng khoán không hợp lệ." }, { status: 400 });
  }

  try {
    const prints = await fetchSessionTape(symbol);
    return NextResponse.json({ symbol, prints, count: prints.length, source: "dnse" });
  } catch (error) {
    return jsonError(error);
  }
}
