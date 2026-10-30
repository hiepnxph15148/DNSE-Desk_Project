import { parseSymbol } from "@/lib/dnse/validate";

export function parseStreamSymbols(raw: string | string[] | undefined | null, limit = 20) {
  const text = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  return text
    .split(",")
    .map((item) => parseSymbol(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
}
