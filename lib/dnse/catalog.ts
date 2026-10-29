import { dnseRequest } from "@/lib/dnse/client";

export type ListedSymbol = {
  symbol: string;
  name: string;
  exchange: string;
};

const MARKETS = [
  { id: "STO", exchange: "HOSE" },
  { id: "STX", exchange: "HNX" },
  { id: "UPX", exchange: "UPCOM" },
] as const;

let cache: { at: number; symbols: ListedSymbol[] } | null = null;
let pending: Promise<ListedSymbol[]> | null = null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

async function loadMarket(marketId: string, exchange: string) {
  const rows: ListedSymbol[] = [];
  for (let page = 1; page <= 6; page += 1) {
    const params = new URLSearchParams({
      marketId,
      securityGroupId: "ST",
      limit: "500",
      page: String(page),
    });
    const body = asRecord(await dnseRequest(`/instruments?${params.toString()}`));
    const data = Array.isArray(body.data) ? body.data : [];
    for (const item of data) {
      const row = asRecord(item);
      const symbol = text(row.symbol).toUpperCase();
      if (!symbol) continue;
      rows.push({
        symbol,
        name: text(row.shortName || row.name) || symbol,
        exchange,
      });
    }
    const total = Number(body.total);
    if (data.length === 0 || (Number.isFinite(total) && rows.length >= total)) break;
  }
  return rows;
}

async function fetchCatalog() {
  const groups = [];
  for (const market of MARKETS) {
    groups.push(...await loadMarket(market.id, market.exchange));
  }
  const unique = new Map<string, ListedSymbol>();
  for (const row of groups) unique.set(row.symbol, row);
  return [...unique.values()];
}

export function loadCatalog() {
  if (cache && Date.now() - cache.at < 6 * 60 * 60 * 1000) return Promise.resolve(cache.symbols);
  if (!pending) {
    pending = fetchCatalog()
      .then((symbols) => {
        cache = { at: Date.now(), symbols };
        return symbols;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export function foldText(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

const NAME_STOP = new Set([
  "ctcp", "tong", "cong", "ty", "co", "phan", "va", "dich", "vu",
  "tap", "doan", "cp", "tnhh", "jsc",
]);

function brandWords(name: string) {
  return foldText(name).split(/[^a-z0-9]+/).filter((word) => word && !NAME_STOP.has(word));
}

export function matchSymbols(catalog: ListedSymbol[], query: string, limit = 8) {
  const needle = foldText(query.trim());
  if (!needle) return [];
  return catalog
    .map((item) => {
      const symbol = item.symbol.toLowerCase();
      const words = brandWords(item.name);
      const initials = words.map((word) => word[0]).join("");
      const brand = words.join(" ");
      let score = 0;
      if (symbol === needle) score += 1000;
      else if (symbol.startsWith(needle)) score += 700 - (symbol.length - needle.length);
      else if (symbol.includes(needle)) score += 420;
      if (initials === needle) score += 650;
      else if (initials.startsWith(needle) && needle.length >= 2) score += 280;
      if (brand === needle) score += 800;
      else if (brand.startsWith(needle)) score += 640;
      else if (brand.includes(` ${needle}`) || brand.includes(needle)) score += 200;
      const index = words.findIndex((word) => word.startsWith(needle));
      if (index >= 0) {
        const word = words[index];
        score += (word === needle ? 520 : 360) - index * 40;
      }
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || left.item.symbol.localeCompare(right.item.symbol))
    .slice(0, limit)
    .map((row) => row.item);
}
