import { createHmac, randomBytes } from "node:crypto";

export class DnseConfigError extends Error {
  constructor() {
    super("Thiếu DNSE_API_SECRET trong .env.local. API Key đã có, secret chỉ hiện một lần khi tạo key trên Entrade X.");
    this.name = "DnseConfigError";
  }
}

export class DnseApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "DnseApiError";
    this.status = status;
    this.body = body;
  }
}

function formatAuxDate(date: Date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${days[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
}

function createNonce() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes.toString("hex");
}

function readMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.msg;
    if (typeof message === "string" && message.trim()) return message;
    if (typeof record.code === "string" && record.code.trim()) return record.code;
  }
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  return `DNSE trả về HTTP ${status}`;
}

export function credentialStatus() {
  const apiKey = process.env.DNSE_API_KEY?.trim() ?? "";
  const apiSecret = process.env.DNSE_API_SECRET?.trim() ?? "";
  return {
    hasKey: apiKey.length > 0,
    hasSecret: apiSecret.length > 0,
    baseUrl: (process.env.DNSE_BASE_URL ?? "https://openapi.dnse.com.vn").replace(/\/$/, ""),
    apiVersion: process.env.DNSE_API_VERSION ?? "2026-07-23",
    marketType: process.env.DNSE_MARKET_TYPE === "DERIVATIVE" ? "DERIVATIVE" : "STOCK",
  };
}

export async function dnseRequest<T = unknown>(
  pathWithQuery: string,
  options: {
    method?: string;
    json?: unknown;
    tradingToken?: string | null;
  } = {},
): Promise<T> {
  const status = credentialStatus();
  if (!status.hasKey || !status.hasSecret) {
    throw new DnseConfigError();
  }

  const method = (options.method ?? "GET").toUpperCase();
  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  const url = `${status.baseUrl}${path}`;
  const date = formatAuxDate(new Date());
  const nonce = createNonce();
  const pathname = new URL(url).pathname;
  const signing = `(request-target): ${method.toLowerCase()} ${pathname}\nx-aux-date: ${date}\nnonce: ${nonce}`;
  const digest = createHmac("sha256", process.env.DNSE_API_SECRET!.trim())
    .update(signing)
    .digest("base64");
  const signature = encodeURIComponent(digest);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-API-Key": process.env.DNSE_API_KEY!.trim(),
    "X-Aux-Date": date,
    "X-Signature": `Signature keyId="${process.env.DNSE_API_KEY!.trim()}",algorithm="hmac-sha256",headers="(request-target) x-aux-date",signature="${signature}",nonce="${nonce}"`,
    version: status.apiVersion,
  };

  let body: string | undefined;
  if (options.json !== undefined) {
    body = JSON.stringify(options.json);
    headers["Content-Type"] = "application/json";
  }
  if (options.tradingToken) {
    headers["Trading-Token"] = options.tradingToken;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
    throw new DnseApiError(
      cause ? `Không kết nối được DNSE: ${cause}` : "Không kết nối được DNSE",
      502,
      null,
    );
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new DnseApiError(readMessage(parsed, response.status), response.status, parsed);
  }

  return parsed as T;
}
