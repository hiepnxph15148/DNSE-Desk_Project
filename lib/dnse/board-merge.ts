import { deriveBoardChange, type BoardRow } from "@/lib/dnse/normalize";

export type DayLimits = {
  reference: number | null;
  ceiling: number | null;
  floor: number | null;
};

export function limitsFromRow(row: BoardRow): DayLimits {
  return { reference: row.reference, ceiling: row.ceiling, floor: row.floor };
}

/** Gắn TC/trần/sàn từ cache ngày — không lấy từ tick socket. */
export function withDayLimits(row: BoardRow, limits: DayLimits): BoardRow {
  return deriveBoardChange({
    ...row,
    reference: limits.reference ?? row.reference,
    ceiling: limits.ceiling ?? row.ceiling,
    floor: limits.floor ?? row.floor,
  });
}

/** Tick realtime: chỉ giá/KL/HL, màu & % so với TC đã cache. */
export function mergeTradeTick(
  row: BoardRow,
  tick: {
    price: number | null;
    volume?: number | null;
    high?: number | null;
    low?: number | null;
  },
): BoardRow {
  if (tick.price == null) return row;
  return deriveBoardChange({
    ...row,
    price: tick.price,
    volume: tick.volume ?? row.volume,
    high: tick.high ?? row.high,
    low: tick.low ?? row.low,
  });
}

export function indexDayLimits(rows: BoardRow[]) {
  const map = new Map<string, DayLimits>();
  for (const row of rows) {
    if (row.reference == null && row.ceiling == null && row.floor == null) continue;
    map.set(row.symbol, limitsFromRow(row));
  }
  return map;
}
