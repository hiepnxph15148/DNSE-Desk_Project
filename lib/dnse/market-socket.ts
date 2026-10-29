import { createHmac } from "node:crypto";
import { credentialStatus } from "@/lib/dnse/client";
import type { MarketEvent, PriceLevel } from "@/lib/dnse/stream-types";

type Listener = (event: MarketEvent) => void;

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function levels(value: unknown): PriceLevel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{ price: asNumber(row.price), quantity: asNumber(row.qtty ?? row.quantity) }];
  });
}

function streamUrl() {
  const base = credentialStatus().baseUrl;
  const host = base.includes("sb-openapi") ? "wss://ws-sb-openapi.dnse.com.vn" : "wss://ws-openapi.dnse.com.vn";
  return `${host}/v1/stream?encoding=json`;
}

class MarketHub {
  private socket: WebSocket | null = null;
  private authed = false;
  private listeners = new Set<Listener>();
  private symbols = new Set<string>();
  private pending = new Set<string>();
  private connecting: Promise<void> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  subscribe(symbols: string[], listener: Listener) {
    this.listeners.add(listener);
    for (const symbol of symbols) {
      if (this.symbols.has(symbol)) continue;
      this.symbols.add(symbol);
      this.pending.add(symbol);
    }
    listener({ kind: "status", state: this.authed ? "live" : "connecting" });
    void this.ensure()
      .then(() => this.flush())
      .catch((error: unknown) => {
        listener({
          kind: "status",
          state: "down",
          detail: error instanceof Error ? error.message : "Không mở được socket DNSE",
        });
      });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: MarketEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private ensure() {
    if (this.authed && this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (!this.connecting) {
      this.connecting = this.connect().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  private connect() {
    const { hasKey, hasSecret } = credentialStatus();
    if (!hasKey || !hasSecret) return Promise.reject(new Error("Thiếu API key để mở socket"));
    this.emit({ kind: "status", state: "connecting" });

    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(streamUrl());
      this.socket = socket;
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const timer = setTimeout(() => {
        fail(new Error("Socket DNSE quá thời gian kết nối"));
        socket.close();
      }, 12_000);

      socket.addEventListener("message", (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const action = typeof data.action === "string" ? data.action : "";
        if (!settled && action === "welcome") {
          this.sendAuth(socket);
          return;
        }
        if (!settled && action === "auth_success") {
          settled = true;
          clearTimeout(timer);
          this.authed = true;
          this.pending = new Set(this.symbols);
          this.flush();
          this.startHeartbeat(socket);
          this.emit({ kind: "status", state: "live" });
          resolve();
          return;
        }
        if (!settled && (action === "auth_error" || action === "error")) {
          clearTimeout(timer);
          const detail = typeof data.message === "string" ? data.message : "Xác thực socket thất bại";
          fail(new Error(detail));
          socket.close();
          return;
        }
        if (action === "ping") {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: "pong" }));
          return;
        }
        this.publish(data);
      });

      socket.addEventListener("close", () => {
        clearTimeout(timer);
        this.authed = false;
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = null;
        if (this.socket === socket) this.socket = null;
        if (!settled) fail(new Error("Socket đóng trước khi xác thực"));
        this.emit({ kind: "status", state: "down" });
        if (this.listeners.size > 0) this.scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        if (!settled) fail(new Error("Không mở được socket DNSE"));
      });
    });
  }

  private sendAuth(socket: WebSocket) {
    const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
    const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = String(Date.now() * 1000);
    const signature = createHmac("sha256", apiSecret).update(`${apiKey}:${timestamp}:${nonce}`).digest("hex");
    socket.send(JSON.stringify({
      action: "auth",
      api_key: apiKey,
      signature,
      timestamp,
      nonce,
    }));
  }

  private flush() {
    if (!this.authed || this.socket?.readyState !== WebSocket.OPEN || this.pending.size === 0) return;
    const symbols = [...this.pending];
    this.pending.clear();
    this.socket?.send(JSON.stringify({
      action: "subscribe",
      channels: ["tick.G1.json", "top_price.G1.json", "security_definition.G1.json"].map((name) => ({
        name,
        symbols,
      })),
    }));
  }

  private publish(data: Record<string, unknown>) {
    const symbol = typeof data.symbol === "string" ? data.symbol.toUpperCase() : "";
    const type = typeof data.T === "string" ? data.T : "";
    if (!symbol) return;
    if (type === "t" || type === "te") {
      this.emit({
        kind: "trade",
        symbol,
        price: asNumber(data.matchPrice),
        quantity: asNumber(data.matchQtty),
        volume: asNumber(data.totalVolumeTraded),
        high: asNumber(data.highestPrice),
        low: asNumber(data.lowestPrice),
      });
      return;
    }
    if (type === "q") {
      this.emit({ kind: "book", symbol, bids: levels(data.bid), asks: levels(data.offer) });
      return;
    }
    if (type === "sd") {
      this.emit({
        kind: "secdef",
        symbol,
        reference: asNumber(data.basicPrice),
        ceiling: asNumber(data.ceilingPrice),
        floor: asNumber(data.floorPrice),
      });
    }
  }

  private startHeartbeat(socket: WebSocket) {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: "ping" }));
    }, 30_000);
  }

  private scheduleReconnect() {
    if (this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      if (this.listeners.size === 0) return;
      void this.ensure().catch(() => {
        this.scheduleReconnect();
      });
    }, 3_000);
  }
}

const globalHub = globalThis as typeof globalThis & { __dnseMarketHub?: MarketHub };

export function marketHub() {
  if (!globalHub.__dnseMarketHub) globalHub.__dnseMarketHub = new MarketHub();
  return globalHub.__dnseMarketHub;
}
