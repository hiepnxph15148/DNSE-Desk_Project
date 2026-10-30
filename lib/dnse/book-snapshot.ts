import type { PriceLevel } from "@/lib/dnse/stream-types";

export function bookFingerprint(bids: PriceLevel[], asks: PriceLevel[]) {
  const slice = (levels: PriceLevel[]) =>
    levels
      .slice(0, 10)
      .map((level) => `${level.price ?? ""}:${level.quantity ?? ""}`)
      .join(",");
  return `${slice(bids)}|${slice(asks)}`;
}
