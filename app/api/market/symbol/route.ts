import { NextResponse, type NextRequest } from "next/server";
import { DnseApiError, DnseConfigError, dnseRequest } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";
import { readCandles, readInstruments, readQuote } from "@/lib/dnse/normalize";
import { parseResolution, parseSymbol } from "@/lib/dnse/validate";
import { lookbackSeconds } from "@/lib/symbols";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const symbol = parseSymbol(request.nextUrl.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "Mã chứng khoán không hợp lệ." }, { status: 400 });
  }

  const resolution = parseResolution(request.nextUrl.searchParams.get("resolution"));
  const candleResolution = resolution === "D" ? "1D" : resolution === "60" ? "1H" : resolution;
  const to = Math.floor(Date.now() / 1000);
  const from = to - lookbackSeconds(resolution);
  const params = new URLSearchParams({
    symbol,
    type: "STOCK",
    resolution: candleResolution,
    from: String(from),
    to: String(to),
  });

  const tolerate = (error: unknown) => {
    if (error instanceof DnseConfigError) throw error;
    if (error instanceof DnseApiError && (error.status === 401 || error.status === 403)) throw error;
    return null;
  };

  try {
    const [secdef, latest, ohlc, instruments] = await Promise.all([
      dnseRequest(`/price/${symbol}/secdef?boardId=G1`).catch(tolerate),
      dnseRequest(`/price/${symbol}/trades/latest?boardId=G1`).catch(tolerate),
      dnseRequest(`/price/ohlc?${params.toString()}`).catch(tolerate),
      dnseRequest(`/instruments?symbol=${symbol}&limit=1`).catch(tolerate),
    ]);
    const instrument = readInstruments(instruments).get(symbol);

    return NextResponse.json({
      quote: readQuote(symbol, secdef, latest, instrument),
      candles: readCandles(ohlc),
      resolution,
    });
  } catch (error) {
    return jsonError(error);
  }
}
