"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketEvent } from "@/lib/dnse/stream-types";

function wsUrl(symbolsKey: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = process.env.NEXT_PUBLIC_MARKET_WS_PORT || "3003";
  const query = new URLSearchParams({ symbols: symbolsKey });
  return `${protocol}//${window.location.hostname}:${port}/api/market/ws?${query.toString()}`;
}

export function useMarketStream(
  symbols: string[],
  enabled: boolean,
  onEvent: (event: MarketEvent) => void,
) {
  const [state, setState] = useState<"off" | "connecting" | "live" | "down">("off");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const key = symbols.join(",");

  useEffect(() => {
    if (!enabled || !key) {
      setState("off");
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      setState(attempt === 0 ? "connecting" : "connecting");
      ws = new WebSocket(wsUrl(key));

      ws.onopen = () => {
        if (closed) return;
        attempt = 0;
      };

      ws.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as MarketEvent;
          if (event.kind === "status") setState(event.state);
          onEventRef.current(event);
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        if (!closed) setState("down");
      };

      ws.onclose = () => {
        if (closed) return;
        setState("down");
        attempt += 1;
        const delay = Math.min(15_000, 1000 * 2 ** Math.min(attempt, 4));
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled, key]);

  return state;
}
