"use client";

import { deskClockLabel } from "@/lib/format";
import { marketLinkStatusLabel, type MarketLinkState } from "@/lib/market-link";

export function DeskClock({ now }: { now: Date | null }) {
  return (
    <time className="desk-clock num" dateTime={now?.toISOString()}>
      {now ? deskClockLabel(now) : "—:—:—"}
    </time>
  );
}

export function MarketLinkStatus({ state }: { state: MarketLinkState }) {
  const ready = state === "live";
  const pending = state === "connecting";
  return (
    <div
      className={`market-link-status${ready ? " is-ready" : ""}${pending ? " is-pending" : ""}${state === "down" ? " is-down" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="market-link-title">Mã liên thông</span>
      <span className="market-link-dot" aria-hidden="true" />
      <span className="market-link-value">{marketLinkStatusLabel(state)}</span>
    </div>
  );
}
