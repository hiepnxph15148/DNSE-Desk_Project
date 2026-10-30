/** Parse payload DNSE WebSocket (tick / sd thường nằm trong `data`). */
export function streamPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const nested = raw.data ?? raw.payload ?? raw.message;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>), ...raw };
  }
  return raw;
}

export function streamMessageType(payload: Record<string, unknown>) {
  const type = payload.T ?? payload.t ?? payload.type;
  return typeof type === "string" ? type.toLowerCase() : "";
}

function channelHint(envelope: Record<string, unknown>) {
  const ch = envelope.channel ?? envelope.Channel ?? envelope.name;
  return typeof ch === "string" ? ch.toLowerCase() : "";
}

/** OpenAPI WS thường không có `T` — suy loại từ channel / field (theo doc DNSE connect). */
export function inferStreamKind(
  payload: Record<string, unknown>,
  envelope: Record<string, unknown> = payload,
): string {
  const explicit = streamMessageType(payload);
  if (explicit) return explicit;

  const ch = channelHint(envelope);
  if (ch.includes("security_definition")) return "sd";
  if (ch.includes("tick_extra")) return "te";
  if (ch.includes("tick")) return "t";
  if (ch.includes("top_price")) return "q";
  if (ch.includes("expected_price")) return "e";

  const tradePrice = pickNum(payload, ["matchPrice", "price", "lastPrice"]);
  const limits = pickNum(payload, ["basicPrice", "referencePrice", "refPrice", "ref_price"]);
  const band = pickNum(payload, ["ceilingPrice", "floorPrice", "ceiling", "floor"]);
  if ((limits != null || band != null) && tradePrice == null) return "sd";
  if (tradePrice != null) return "t";
  if (Array.isArray(payload.bid) || Array.isArray(payload.offer)) return "q";
  return "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function pickNum(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

/** Cùng field REST + stream (sd, te). */
export function readStreamLimits(record: Record<string, unknown>, price: number | null = null) {
  const reference = pickNum(record, ["basicPrice", "referencePrice", "refPrice", "ref_price"]);
  const ceiling = pickNum(record, [
    "ceiling",
    "ceilingPrice",
    "ceilPrice",
    "highLimitPrice",
    "ceiling_price",
  ]);
  const floor = pickNum(record, ["floor", "floorPrice", "lowLimitPrice", "floor_price"]);
  return harmonizeLimitScale(price, { reference, ceiling, floor });
}

/** Secdef/tick đôi khi trả VND (×1000) so với matchPrice hiển thị. */
export function harmonizeLimitScale(
  price: number | null,
  limits: { reference: number | null; ceiling: number | null; floor: number | null },
) {
  const scale = (value: number | null) => {
    if (value == null || price == null || price === 0) return value;
    const abs = Math.abs(value);
    const p = Math.abs(price);
    if (abs >= p * 40 && abs <= p * 400) {
      const down = value / 1000;
      if (Math.abs(down - price) <= Math.abs(value - price)) return down;
    }
    return value;
  };
  return {
    reference: scale(limits.reference),
    ceiling: scale(limits.ceiling),
    floor: scale(limits.floor),
  };
}
