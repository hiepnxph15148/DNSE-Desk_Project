import { NextResponse } from "next/server";
import { DnseApiError, DnseConfigError } from "@/lib/dnse/client";
import { friendlyDnseError } from "@/lib/dnse/friendly-error";

export { friendlyDnseError };

export function jsonError(error: unknown) {
  if (error instanceof DnseConfigError) {
    return NextResponse.json({ error: error.message, code: "CONFIG" }, { status: 503 });
  }
  if (error instanceof DnseApiError) {
    return NextResponse.json(
      { error: friendlyDnseError(error.message), code: "DNSE", status: error.status },
      { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
    );
  }
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  return NextResponse.json({ error: message, code: "INTERNAL" }, { status: 500 });
}

export const TRADING_COOKIE = "dnse_trading_token";

export function tradingCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
