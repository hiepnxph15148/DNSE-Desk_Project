import { DnseApiError, dnseRequest } from "@/lib/dnse/client";
import { readSecdefLimits, type SecdefLimits } from "@/lib/dnse/normalize";

const TTL_MS = 6 * 60 * 60 * 1000;

type CacheState = {
  rows: Map<string, { at: number; row: SecdefLimits }>;
  tail: Promise<void>;
};

const state: CacheState = ((globalThis as typeof globalThis & { __dnseSecdef?: CacheState }).__dnseSecdef ??= {
  rows: new Map(),
  tail: Promise.resolve(),
});

function secdefSnapshot(body: unknown) {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") return body;
  const record = row as Record<string, unknown>;
  return {
    symbol: record.symbol,
    marketId: record.marketId,
    basicPrice: record.basicPrice,
    ceilingPrice: record.ceilingPrice,
    floorPrice: record.floorPrice,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue<T>(task: () => Promise<T>) {
  const run = state.tail.then(task, task);
  state.tail = run.then(() => undefined, () => undefined);
  return run;
}

/** Trần/sàn/tham chiếu gần như cố định trong phiên — không gọi lại DNSE mỗi lần refresh. */
export function loadSecdef(symbol: string, boardId = "G1") {
  const key = `${boardId}:${symbol}`;
  const hit = state.rows.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.row);

  return enqueue(async () => {
    const again = state.rows.get(key);
    if (again && Date.now() - again.at < TTL_MS) return again.row;

    const path = `/price/${symbol}/secdef?boardId=${boardId}`;
    try {
      const body = await dnseRequest(path);
      const row = readSecdefLimits(symbol, body);
      // eslint-disable-next-line no-console
      console.log("[secdef]", path, {
        marketId: row.marketId,
        basicPrice: row.reference,
        ceilingPrice: row.ceiling,
        floorPrice: row.floor,
        raw: secdefSnapshot(body),
      });
      if (row.reference != null || row.ceiling != null || row.floor != null) {
        state.rows.set(key, { at: Date.now(), row });
      }
      await sleep(350);
      return row;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log("[secdef]", path, error instanceof Error ? error.message : error);
      if (again) return again.row;
      if (error instanceof DnseApiError && error.status === 429 && hit) return hit.row;
      throw error;
    }
  });
}
