import { pickNum } from "@/lib/dnse/stream-limits";
import type { PriceLevel } from "@/lib/dnse/stream-types";

function sideLevels(value: unknown): PriceLevel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [{
      price: pickNum(row, ["price", "p"]),
      quantity: pickNum(row, ["qtty", "quantity", "qty", "volume"]),
    }];
  });
}

export function readStreamBook(payload: Record<string, unknown>) {
  return {
    bids: sideLevels(payload.bid ?? payload.bids ?? payload.buy),
    asks: sideLevels(payload.offer ?? payload.offers ?? payload.ask ?? payload.sell),
  };
}
