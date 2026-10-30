export type MarketLinkState = "off" | "connecting" | "live" | "down";

export function marketLinkStatusLabel(state: MarketLinkState) {
  if (state === "live") return "Sẵn sàng";
  if (state === "connecting") return "Đang nối";
  if (state === "down") return "Ngắt kết nối";
  return "Chưa bật";
}
