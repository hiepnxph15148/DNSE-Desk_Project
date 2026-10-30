import { num } from "@/lib/dnse/normalize";
import type { PriceLevel } from "@/lib/dnse/stream-types";

function asRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return asRecord(value[0]);
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function sideLevels(value: unknown): PriceLevel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const price = num(row.price);
    const quantity = num(row.quantity ?? row.qtty ?? row.qty);
    if (price == null && quantity == null) return [];
    return [{ price, quantity }];
  });
}

/** REST `GET /price/{symbol}/quotes/latest?boardId=G1` */
export function readQuoteBook(body: unknown) {
  const root = asRecord(body);
  const quote = asRecord(Array.isArray(root.quotes) ? root.quotes[0] : root);
  return {
    bids: sideLevels(quote.bid ?? quote.bids ?? quote.buy),
    asks: sideLevels(quote.offer ?? quote.offers ?? quote.ask ?? quote.sell),
  };
}
