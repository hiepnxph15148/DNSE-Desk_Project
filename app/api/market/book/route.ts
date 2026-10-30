import { NextResponse, type NextRequest } from "next/server";
import { dnseRequest } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";
import { readQuoteBook } from "@/lib/dnse/read-quotes";
import { parseSymbol } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const symbol = parseSymbol(request.nextUrl.searchParams.get("symbol"));
  if (!symbol) {
    return NextResponse.json({ error: "Mã chứng khoán không hợp lệ." }, { status: 400 });
  }

  try {
    const body = await dnseRequest(`/price/${symbol}/quotes/latest?boardId=G1`);
    const book = readQuoteBook(body);
    return NextResponse.json({ symbol, ...book, source: "dnse" });
  } catch (error) {
    return jsonError(error);
  }
}
