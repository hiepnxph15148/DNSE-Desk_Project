import type { IncomingMessage } from "node:http";
import { parse } from "node:url";
import type { WebSocket } from "ws";
import { attachMarketStream } from "@/lib/dnse/market-stream-bridge";
import { parseStreamSymbols } from "@/lib/dnse/parse-stream-symbols";
import type { MarketEvent } from "@/lib/dnse/stream-types";

function sendJson(ws: WebSocket, event: MarketEvent) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(event));
}

export function handleMarketWsConnection(ws: WebSocket, req: IncomingMessage) {
  const { query } = parse(req.url ?? "", true);
  const symbols = parseStreamSymbols(query.symbols);
  if (symbols.length === 0) {
    ws.close(4400, "Thieu symbols");
    return;
  }

  const detach = attachMarketStream(symbols, (event) => sendJson(ws, event));
  ws.on("close", () => detach());
  ws.on("error", () => detach());
}
