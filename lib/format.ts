export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return formatNumber(value, digits);
}

export function formatQty(value: number | null | undefined) {
  return formatNumber(value, 0);
}

export function formatPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatChange(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPrice(value)}`;
}

export type PriceTone = "up" | "down" | "ref" | "ceiling" | "floor" | "flat";

export function priceTone(
  price: number | null | undefined,
  reference: number | null | undefined,
  ceiling: number | null | undefined,
  floor: number | null | undefined,
): PriceTone {
  if (price == null) return "flat";
  if (ceiling != null && price >= ceiling) return "ceiling";
  if (floor != null && price <= floor) return "floor";
  if (reference == null || price === reference) return "ref";
  return price > reference ? "up" : "down";
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ gửi",
  pendingnew: "Chờ gửi",
  new: "Chờ khớp",
  accepted: "Chờ khớp",
  partiallyfilled: "Khớp một phần",
  partially_filled: "Khớp một phần",
  filled: "Khớp hết",
  rejected: "Từ chối",
  expired: "Hết hạn",
  doneforday: "Hết phiên",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
};

export function orderStatusLabel(status: string) {
  const key = status.replace(/[\s_-]/g, "").toLowerCase();
  return STATUS_LABEL[key] ?? (status || "—");
}

export function sideLabel(side: string) {
  if (side === "NB") return "Mua";
  if (side === "NS") return "Bán";
  return side || "—";
}

export function canCancel(status: string) {
  const key = status.replace(/[\s_-]/g, "").toLowerCase();
  return ["pending", "pendingnew", "new", "accepted", "partiallyfilled"].includes(key);
}

export function clockLabel(date: Date) {
  return deskClockLabel(date);
}

export function deskClockLabel(date: Date) {
  if (Number.isNaN(date.getTime())) return "—:—:—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
