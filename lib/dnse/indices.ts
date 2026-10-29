import { dnseRequest } from "@/lib/dnse/client";
import { mapLimit } from "@/lib/dnse/limit";
import { readCandles } from "@/lib/dnse/normalize";

export type IndexSpark = { time: number; close: number; volume: number };

export type IndexQuote = {
  symbol: string;
  name: string;
  marketId: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  spark: IndexSpark[];
};

const PREFERRED = ["VNINDEX", "VN30", "VNXALLSHARE", "HNX", "HNX30", "UPCOM"];

type ListedIndex = { symbol: string; name: string; marketId: string };

let listedCache: { at: number; rows: ListedIndex[] } | null = null;
let quoteCache: { at: number; rows: IndexQuote[] } | null = null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

async function listIndices() {
  if (listedCache && Date.now() - listedCache.at < 6 * 60 * 60 * 1000) return listedCache.rows;
  const rows: ListedIndex[] = [];
  for (let page = 1; page <= 12; page += 1) {
    const body = asRecord(await dnseRequest(`/instruments?limit=500&page=${page}`));
    const data = Array.isArray(body.data) ? body.data : [];
    for (const item of data) {
      const row = asRecord(item);
      if (text(row.securityGroupId)) continue;
      const symbol = text(row.symbol).toUpperCase();
      if (!symbol) continue;
      rows.push({
        symbol,
        name: text(row.shortName || row.name) || symbol,
        marketId: text(row.marketId),
      });
    }
    if (data.length < 500) break;
  }
  rows.sort((left, right) => {
    const leftRank = PREFERRED.indexOf(left.symbol);
    const rightRank = PREFERRED.indexOf(right.symbol);
    return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank) || left.symbol.localeCompare(right.symbol);
  });
  listedCache = { at: Date.now(), rows };
  return rows;
}

async function quoteIndex(item: ListedIndex): Promise<IndexQuote> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 25 * 24 * 60 * 60;
  const params = new URLSearchParams({
    symbol: item.symbol,
    type: "INDEX",
    resolution: "1D",
    from: String(from),
    to: String(to),
  });
  const candles = readCandles(await dnseRequest(`/price/ohlc?${params.toString()}`).catch(() => null));
  const last = candles.at(-1);
  const previous = candles.length > 1 ? candles[candles.length - 2] : undefined;
  const price = last?.close ?? null;
  const reference = previous?.close ?? null;
  const change = price != null && reference != null ? price - reference : null;
  const changePercent = change != null && reference ? (change / reference) * 100 : null;
  const intra = new URLSearchParams({
    symbol: item.symbol,
    type: "INDEX",
    resolution: "5",
    from: String(to - 4 * 24 * 60 * 60),
    to: String(to),
  });
  const intraday = readCandles(await dnseRequest(`/price/ohlc?${intra.toString()}`).catch(() => null));
  return {
    ...item,
    price,
    change,
    changePercent,
    volume: last?.volume ?? null,
    spark: sessionSpark(intraday),
  };
}

function sessionSpark(candles: { time: number; close: number; volume: number }[]): IndexSpark[] {
  const last = candles.at(-1);
  if (!last) return [];
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(last.time * 1000));
  return candles.flatMap((candle) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candle.time * 1000));
    const date = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
    const clock = Number(parts.find((part) => part.type === "hour")?.value ?? "0") * 60
      + Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    if (date !== day || clock < 9 * 60 || clock > 15 * 60) return [];
    return [{ time: candle.time, close: candle.close, volume: candle.volume }];
  });
}

export async function loadIndexQuotes() {
  if (quoteCache && Date.now() - quoteCache.at < 45_000) return quoteCache.rows;
  const listed = await listIndices();
  const rows = await mapLimit(listed, 2, quoteIndex);
  quoteCache = { at: Date.now(), rows };
  return rows;
}
