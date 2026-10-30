export type TapePrint = {
  id: number;
  symbol: string;
  price: number | null;
  quantity: number | null;
  at: number;
};

/** Số dòng khớp lệnh giữ trong cache theo từng mã (realtime + REST). */
export const TAPE_CACHE_MAX = 200;

export function tapeFingerprint(print: Pick<TapePrint, "symbol" | "price" | "quantity" | "at">) {
  return `${print.symbol}:${print.at}:${print.price ?? ""}:${print.quantity ?? ""}`;
}

export function appendTapePrint(current: TapePrint[], print: TapePrint) {
  const key = tapeFingerprint(print);
  if (current.some((item) => tapeFingerprint(item) === key)) return current;
  const head = current[0];
  if (
    head
    && head.symbol === print.symbol
    && head.price === print.price
    && head.quantity === print.quantity
    && Math.abs(head.at - print.at) < 500
  ) {
    return current;
  }
  return [print, ...current].slice(0, TAPE_CACHE_MAX);
}

/** Gộp cache hiện có với dữ liệu API — không bao giờ xóa cache vì API trả ít hơn. */
export function mergeTapeCaches(cached: TapePrint[], incoming: TapePrint[], max = TAPE_CACHE_MAX) {
  const seen = new Set<string>();
  const merged: TapePrint[] = [];
  const ordered = [...cached, ...incoming].sort((a, b) => b.at - a.at);
  for (const print of ordered) {
    const key = tapeFingerprint(print);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(print);
    if (merged.length >= max) break;
  }
  return merged;
}

/** @deprecated dùng mergeTapeCaches */
export function mergeSessionTape(session: TapePrint[], live: TapePrint[], max = TAPE_CACHE_MAX) {
  return mergeTapeCaches(live, session, max);
}
