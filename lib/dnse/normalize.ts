export type BoardRow = {
  symbol: string;
  name: string;
  exchange: string;
  price: number | null;
  reference: number | null;
  ceiling: number | null;
  floor: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  change: number | null;
  changePercent: number | null;
  time: string | null;
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AccountRow = { id: string; name: string };
export type BalanceView = { availableCash: number | null; totalCash: number | null };
export type OrderRow = {
  id: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number | null;
  price: number | null;
  status: string;
  filled: number | null;
  createdAt: string | null;
};
export type PositionRow = {
  id: string;
  symbol: string;
  quantity: number | null;
  averagePrice: number | null;
  marketPrice: number | null;
};
export type LoanPackage = { id: string; name: string; initialRate: number | null };
export type PowerView = { buyingPower: number | null; sellingPower: number | null };

const MARKET_LABEL: Record<string, string> = {
  STO: "HOSE",
  STX: "HNX",
  UPX: "UPCOM",
  DVX: "Phái sinh",
};

function asRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return asRecord(value[0]);
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function arrayFrom(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

export function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNum(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = num(record[key]);
    if (value != null) return value;
  }
  return null;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function withChange(row: Omit<BoardRow, "change" | "changePercent">): BoardRow {
  const change = row.price != null && row.reference != null ? row.price - row.reference : null;
  const changePercent = change != null && row.reference ? (change / row.reference) * 100 : null;
  return { ...row, change, changePercent };
}

export function readQuote(symbol: string, secdef: unknown, latest: unknown, instrument?: unknown): BoardRow {
  const definition = asRecord(secdef);
  const latestRecord = asRecord(latest);
  const trades = Array.isArray(latestRecord.trades) ? latestRecord.trades : [];
  const trade = asRecord(trades[0] ?? latestRecord);
  const info = asRecord(instrument);
  const marketId = text(definition.marketId || info.marketId || definition.exchange);
  const price = firstNum(trade, ["matchPrice", "price", "lastPrice"])
    ?? firstNum(definition, ["matchPrice", "lastPrice", "closePrice", "expectedPrice"]);

  return withChange({
    symbol,
    name: text(info.shortName || info.name || definition.symbolName || definition.shortName) || symbol,
    exchange: MARKET_LABEL[marketId] ?? marketId,
    price,
    reference: firstNum(definition, ["basicPrice", "referencePrice", "refPrice", "prevClosePrice"]),
    ceiling: firstNum(definition, ["ceilingPrice", "ceilPrice", "highLimitPrice"]),
    floor: firstNum(definition, ["floorPrice", "lowLimitPrice"]),
    high: firstNum(trade, ["highestPrice", "high"]) ?? firstNum(definition, ["high", "highest", "highPrice"]),
    low: firstNum(trade, ["lowestPrice", "low"]) ?? firstNum(definition, ["low", "lowest", "lowPrice"]),
    volume: firstNum(trade, ["totalVolumeTraded", "accumulatedVolume", "volume"])
      ?? firstNum(definition, ["totalVolume", "accumulatedVolume", "volume"]),
    time: text(trade.time || trade.sendingTime || trade.matchTime) || null,
  });
}

export function readInstruments(body: unknown) {
  const map = new Map<string, unknown>();
  for (const item of arrayFrom(body, ["data", "instruments"])) {
    const row = asRecord(item);
    const symbol = text(row.symbol);
    if (symbol) map.set(symbol, row);
  }
  return map;
}

export function readCandles(body: unknown): Candle[] {
  const record = asRecord(body);
  if (Array.isArray(record.t) && Array.isArray(record.c)) {
    const times = record.t as unknown[];
    const opens = (record.o as unknown[]) ?? [];
    const highs = (record.h as unknown[]) ?? [];
    const lows = (record.l as unknown[]) ?? [];
    const closes = record.c as unknown[];
    const volumes = (record.v as unknown[]) ?? [];
    return times.flatMap((time, index) => {
      const close = num(closes[index]);
      const open = num(opens[index]) ?? close;
      const high = num(highs[index]) ?? close;
      const low = num(lows[index]) ?? close;
      const stamp = num(time);
      if (close == null || stamp == null) return [];
      return [{
        time: stamp > 10_000_000_000 ? Math.floor(stamp / 1000) : stamp,
        open: open ?? close,
        high: high ?? close,
        low: low ?? close,
        close,
        volume: num(volumes[index]) ?? 0,
      }];
    });
  }

  return arrayFrom(body, ["data", "ohlc", "candles", "items"]).flatMap((item) => {
    const row = asRecord(item);
    const close = firstNum(row, ["close", "c"]);
    const stamp = firstNum(row, ["time", "t", "timestamp"]);
    if (close == null || stamp == null) return [];
    return [{
      time: stamp > 10_000_000_000 ? Math.floor(stamp / 1000) : stamp,
      open: firstNum(row, ["open", "o"]) ?? close,
      high: firstNum(row, ["high", "h"]) ?? close,
      low: firstNum(row, ["low", "l"]) ?? close,
      close,
      volume: firstNum(row, ["volume", "v"]) ?? 0,
    }];
  });
}

export function readAccounts(body: unknown): AccountRow[] {
  const root = asRecord(body);
  const owner = text(root.name);
  return arrayFrom(body, ["accounts", "data"]).flatMap((item) => {
    const row = asRecord(item);
    const id = text(row.id || row.accountNo || row.accountNumber);
    if (!id) return [];
    const name = text(row.accountTypeName || row.derivativeAccountType || row.name || row.type) || owner || "Tiểu khoản";
    return [{ id, name }];
  });
}

export function readBalance(body: unknown): BalanceView {
  const root = asRecord(body);
  const stock = asRecord(root.stock);
  const derivative = asRecord(root.derivative);
  return {
    availableCash: firstNum(stock, ["availableCash", "cash", "withdrawableCash"])
      ?? firstNum(derivative, ["availableCash", "cash"])
      ?? firstNum(root, ["availableCash", "totalCash"]),
    totalCash: firstNum(stock, ["totalCash", "cash"])
      ?? firstNum(derivative, ["totalCash"])
      ?? firstNum(root, ["totalCash"]),
  };
}

export function readOrders(body: unknown): OrderRow[] {
  return arrayFrom(body, ["orders", "data"]).flatMap((item) => {
    const row = asRecord(item);
    const id = text(row.id || row.orderId);
    if (!id) return [];
    return [{
      id,
      symbol: text(row.symbol),
      side: text(row.side),
      orderType: text(row.orderType),
      quantity: num(row.quantity),
      price: num(row.price),
      status: text(row.orderStatus || row.status),
      filled: num(row.fillQuantity ?? row.filledQuantity),
      createdAt: text(row.createdDate || row.modifiedDate || row.transDate) || null,
    }];
  });
}

export function readPositions(body: unknown): PositionRow[] {
  return arrayFrom(body, ["positions", "data", "portfolio"]).flatMap((item) => {
    const row = asRecord(item);
    const nested = asRecord(row.data);
    const source = Object.keys(nested).length > 0 ? nested : row;
    const symbol = text(source.symbol);
    const id = text(source.id || source.positionId || symbol);
    if (!symbol && !id) return [];
    return [{
      id,
      symbol,
      quantity: firstNum(source, ["openQuantity", "tradeQuantity", "quantity", "totalQuantity"]),
      averagePrice: firstNum(source, ["averageCostPrice", "costPrice", "averagePrice"]),
      marketPrice: firstNum(source, ["marketPrice", "currentPrice", "lastPrice"]),
    }];
  });
}

export function readLoanPackages(body: unknown): LoanPackage[] {
  return arrayFrom(body, ["loanPackages", "packages", "data", "items"]).flatMap((item) => {
    const row = asRecord(item);
    const id = text(row.id || row.loanPackageId);
    if (!id) return [];
    return [{
      id,
      name: text(row.name || row.packageName || row.description) || `Gói ${id}`,
      initialRate: firstNum(row, ["initialRate", "initialMarginRate", "marginRate"]),
    }];
  });
}

export function readPower(body: unknown): PowerView {
  const row = asRecord(body);
  const nested = asRecord(row.data);
  const source = Object.keys(nested).length > 0 ? nested : row;
  return {
    buyingPower: firstNum(source, ["buyingPower", "ppse", "maxBuyQuantity", "availableBuyQuantity"]),
    sellingPower: firstNum(source, ["sellingPower", "maxSellQuantity", "availableQuantity", "sellableQuantity"]),
  };
}
