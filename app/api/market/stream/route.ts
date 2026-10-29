import { NextResponse, type NextRequest } from "next/server";
import { marketHub } from "@/lib/dnse/market-socket";
import type { MarketEvent } from "@/lib/dnse/stream-types";
import { parseSymbol } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const symbols = (request.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((item) => parseSymbol(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Danh sách mã không hợp lệ." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: MarketEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      unsubscribe = marketHub().subscribe(symbols, send);
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (ping) clearInterval(ping);
        }
      }, 15_000);
      request.signal.addEventListener("abort", () => {
        if (ping) clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* stream already closed */
        }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
