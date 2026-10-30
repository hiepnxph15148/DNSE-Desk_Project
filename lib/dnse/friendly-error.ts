export function friendlyDnseError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("api key not found")) {
    return "DNSE không nhận API Key trong .env.local (key đã xóa, hết hạn hoặc không khớp môi trường). Tạo lại Open API trên Entrade X, dán DNSE_API_KEY và DNSE_API_SECRET, rồi restart npm run dev.";
  }
  if (lower.includes("invalid signature") || lower.includes("signature")) {
    return "DNSE_API_SECRET không đúng với API Key. Secret chỉ hiện một lần khi tạo key — tạo key mới nếu đã mất.";
  }
  return message;
}
