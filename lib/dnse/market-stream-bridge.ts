import { marketHub } from "@/lib/dnse/market-socket";
import type { MarketEvent } from "@/lib/dnse/stream-types";

/** Hub DNSE → một client (WebSocket trình duyệt). */
export function attachMarketStream(
  symbols: string[],
  send: (event: MarketEvent) => void,
): () => void {
  return marketHub().subscribe(symbols, send);
}
