export type PriceLevel = {
  price: number | null;
  quantity: number | null;
};

export type MarketEvent =
  | { kind: "status"; state: "live" | "connecting" | "down"; detail?: string }
  | {
      kind: "trade";
      symbol: string;
      price: number | null;
      quantity: number | null;
      volume: number | null;
      high: number | null;
      low: number | null;
    }
  | { kind: "book"; symbol: string; bids: PriceLevel[]; asks: PriceLevel[] }
  | {
      kind: "secdef";
      symbol: string;
      reference: number | null;
      ceiling: number | null;
      floor: number | null;
    };
