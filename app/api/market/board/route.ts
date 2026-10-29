import { NextResponse, type NextRequest } from "next/server";
import { DnseApiError, DnseConfigError, dnseRequest } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";
import { readInstruments, readQuote, type BoardRow } from "@/lib/dnse/normalize";
import { mapLimit } from "@/lib/dnse/limit";
import { parseSymbol } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFatal(error: unknown) {
  if (error instanceof DnseConfigError) return true;
  return error instanceof DnseApiError && (error.status === 401 || error.status === 403);
}

async function loadSymbol(symbol: string, instrument: unknown): Promise<BoardRow> {
  const [secdef, latest] = await Promise.all([
    dnseRequest(`/price/${symbol}/secdef?boardId=G1`).catch((error: unknown) => {
      if (isFatal(error)) throw error;
      return null;
    }),
    dnseRequest(`/price/${symbol}/trades/latest?boardId=G1`).catch((error: unknown) => {
      if (isFatal(error)) throw error;
      return null;
    }),
  ]);
  return readQuote(symbol, secdef, latest, instrument);
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
    const directory = await dnseRequest(
      `/instruments?${new URLSearchParams({ symbol: symbols.join(","), limit: String(symbols.length) }).toString()}`,
    ).catch((error: unknown) => {
      if (isFatal(error)) throw error;
      return null;
    });
    const instruments = readInstruments(directory);
    const rows = await mapLimit(symbols, 4, (symbol) => loadSymbol(symbol, instruments.get(symbol)));
    return NextResponse.json({ rows });
  } catch (error) {
    return jsonError(error);
  }
}
