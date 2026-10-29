const SYMBOL = /^[A-Z0-9.]{1,16}$/;
const ACCOUNT = /^[A-Za-z0-9]{4,32}$/;
const ORDER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type MarketType = "STOCK" | "DERIVATIVE";

export function parseSymbol(value: string | null | undefined) {
  if (!value) return null;
  const symbol = value.trim().toUpperCase();
  return SYMBOL.test(symbol) ? symbol : null;
}

export function parseAccount(value: string | null | undefined) {
  if (!value) return null;
  const account = value.trim();
  return ACCOUNT.test(account) ? account : null;
}

export function parseOrderId(value: string | null | undefined) {
  if (!value) return null;
  const id = value.trim();
  return ORDER_ID.test(id) ? id : null;
}

export function parseMarketType(value: string | null | undefined): MarketType {
  return value === "DERIVATIVE" ? "DERIVATIVE" : "STOCK";
}

export function parseResolution(value: string | null | undefined) {
  if (value === "1" || value === "5" || value === "15" || value === "60" || value === "D") {
    return value;
  }
  return "D";
}

const ORDER_TYPES = new Set(["LO", "MTL", "ATO", "ATC", "MOK", "MAK", "MP"]);

export function parseOrderType(value: string | null | undefined) {
  const type = (value ?? "LO").toUpperCase();
  return ORDER_TYPES.has(type) ? type : null;
}

export function parseSide(value: string | null | undefined) {
  return value === "NB" || value === "NS" ? value : null;
}

export function parseQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) return null;
  return quantity;
}

export function parsePrice(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return null;
  return price;
}
