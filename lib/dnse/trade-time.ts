export function tradeAtToday(hour: number, minute: number, second: number, base = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const pad = (value: number) => String(value).padStart(2, "0");
  const iso = `${year}-${month}-${day}T${pad(hour)}:${pad(minute)}:${pad(second)}+07:00`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
}

export function parseTradeAt(raw: unknown, base = new Date()) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 1e15) return Math.floor(raw / 1_000_000);
    if (raw > 1e12) return raw;
    if (raw > 1e9) return raw * 1000;
    if (raw >= 0 && raw < 240_000) {
      const text = String(Math.floor(raw)).padStart(6, "0");
      const hour = Number(text.slice(0, 2));
      const minute = Number(text.slice(2, 4));
      const second = Number(text.slice(4, 6));
      if (hour < 24 && minute < 60 && second < 60) return tradeAtToday(hour, minute, second, base);
    }
    const scaled = raw * 1000;
    return Number.isFinite(scaled) ? scaled : Date.now();
  }
  if (typeof raw === "string" && raw.trim()) {
    const text = raw.trim();
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return parsed;
    const clock = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(text);
    if (clock) {
      const hour = Number(clock[1]);
      const minute = Number(clock[2]);
      const second = Number(clock[3]);
      if (hour < 24 && minute < 60 && second < 60) return tradeAtToday(hour, minute, second, base);
    }
  }
  return Date.now();
}

export function parseTradeAtFromRecord(record: Record<string, unknown>) {
  return parseTradeAt(record.matchTime ?? record.sendingTime ?? record.time ?? record.timestamp);
}
