import { createServer } from "node:http";
import { parse } from "node:url";
import { WebSocketServer } from "ws";
import { handleMarketWsConnection } from "@/lib/dnse/market-ws-handler";

const globalState = globalThis as typeof globalThis & { __dnseMarketWsServer?: boolean };

/** WS market cùng process Next (cùng .env và marketHub). Trình duyệt nối thẳng cổng này. */
export function ensureMarketWsServer() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (globalState.__dnseMarketWsServer) return;
  globalState.__dnseMarketWsServer = true;

  const port = Number(process.env.MARKET_WS_PORT ?? process.env.NEXT_PUBLIC_MARKET_WS_PORT ?? 3003);
  const server = createServer((req, res) => {
    const { pathname } = parse(req.url ?? "", true);
    if (pathname === "/api/market/ws") {
      res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("WebSocket only");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "", true);
    if (pathname === "/api/market/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
      return;
    }
    socket.destroy();
  });

  wss.on("connection", (ws, req) => {
    handleMarketWsConnection(ws, req);
  });

  server.on("error", (error) => {
    globalState.__dnseMarketWsServer = false;
    // eslint-disable-next-line no-console
    console.error("[market-ws]", error);
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`> Market WS ws://localhost:${port}/api/market/ws?symbols=...`);
  });
}
