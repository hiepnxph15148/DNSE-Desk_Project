import { NextResponse, type NextRequest } from "next/server";
import { DnseApiError, DnseConfigError, dnseRequest } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";
import { readCandles } from "@/lib/dnse/normalize";
import { mapLimit } from "@/lib/dnse/limit";
import { parseSymbol } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFatal(error: unknown) {
  if (error instanceof DnseConfigError) return true;
  return error instanceof DnseApiError && (error.status === 401 || error.status === 403);
}

async function closesFor(symbol: string) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * 140;
  const params = new URLSearchParams({
    symbol,
    type: "STOCK",
    resolution: "1D",
    from: String(from),
    to: String(to),
  });
  const body = await dnseRequest(`/price/ohlc?${params.toString()}`).catch((error: unknown) => {
    if (isFatal(error)) throw error;
    return null;
  });
  return readCandles(body).slice(-36).map((candle) => candle.close);
}

export async function GET(request: NextRequest) {
  const symbols = (request.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((item) => parseSymbol(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Danh sách mã không hợp lệ." }, { status: 400 });
  }

  try {
    const series = await mapLimit(symbols, 3, async (symbol) => [symbol, await closesFor(symbol)] as const);
    return NextResponse.json({ sparks: Object.fromEntries(series) });
  } catch (error) {
    return jsonError(error);
  }
}
