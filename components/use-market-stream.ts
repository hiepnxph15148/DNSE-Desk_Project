"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketEvent } from "@/lib/dnse/stream-types";

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
    setState("connecting");
    const source = new EventSource(`/api/market/stream?symbols=${encodeURIComponent(key)}`);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as MarketEvent;
      if (event.kind === "status") setState(event.state);
      onEventRef.current(event);
    };
    source.onerror = () => setState("down");
    return () => source.close();
  }, [enabled, key]);

  return state;
}
