import { num } from "@/lib/dnse/normalize";
import { parseTradeAtFromRecord } from "@/lib/dnse/trade-time";
import type { TapePrint } from "@/lib/dnse/tape";

function asRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return asRecord(value[0]);
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function tradeRows(body: unknown) {
  if (Array.isArray(body)) return body;
  const record = asRecord(body);
  for (const key of ["trades", "data", "items", "results"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function unixSeconds(value: number) {
  if (value > 1e12) return Math.floor(value / 1000);
  if (value > 1e9) return Math.floor(value);
  return value;
}

function pickUnix(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = num(record[key]);
    if (value != null) return unixSeconds(value);
  }
  return undefined;
}

/** Khoảng thời gian do DNSE trả về — không tự suy ra giờ mở phiên. */
export function readTradesQueryWindow(body: unknown) {
  const record = asRecord(body);
  const from = pickUnix(record, ["from", "fromTime", "fromDate", "sessionFrom", "startTime"]);
  const to = pickUnix(record, ["to", "toTime", "toDate", "sessionTo", "endTime"]);
  return { from, to };
}

export function readTradePage(body: unknown) {
  const record = asRecord(body);
  const nextPageToken =
    typeof record.nextPageToken === "string" ? record.nextPageToken
      : typeof record.next_page_token === "string" ? record.next_page_token
        : null;
  return { rows: tradeRows(body), nextPageToken, window: readTradesQueryWindow(body) };
}

export function readSessionTape(symbol: string, body: unknown, idStart = 1): TapePrint[] {
  const rows = tradeRows(body);
  const prints: TapePrint[] = [];
  let id = idStart;
  for (const item of rows) {
    const row = asRecord(item);
    const price = num(row.matchPrice ?? row.price ?? row.lastPrice);
    if (price == null) continue;
    prints.push({
      id: id++,
      symbol,
      price,
      quantity: num(row.matchQtty ?? row.quantity ?? row.qtty),
      at: parseTradeAtFromRecord(row),
    });
  }
  return prints;
}
