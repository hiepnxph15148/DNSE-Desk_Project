import { NextResponse, type NextRequest } from "next/server";
import { dnseRequest } from "@/lib/dnse/client";
import { jsonError, TRADING_COOKIE, tradingCookieOptions } from "@/lib/dnse/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readToken(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  const value = record.tradingToken ?? record.token ?? record.accessToken;
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as { otpType?: string; passcode?: string } | null;
  const otpType = payload?.otpType === "smart_otp" ? "smart_otp" : payload?.otpType === "email_otp" ? "email_otp" : null;
  const passcode = payload?.passcode?.trim() ?? "";
  if (!otpType || !/^\d{4,8}$/.test(passcode)) {
    return NextResponse.json({ error: "Nhập OTP gồm 4 đến 8 chữ số." }, { status: 400 });
  }

  try {
    const created = await dnseRequest("/registration/trading-token", {
      method: "POST",
      json: { otpType, passcode },
    });
    const tradingToken = readToken(created);
    if (!tradingToken) {
      return NextResponse.json({ error: "DNSE không trả trading token." }, { status: 502 });
    }
    const response = NextResponse.json({
      ok: true,
      message: "Đã xác thực. Trading token có hiệu lực khoảng 8 giờ trên server này.",
    });
    response.cookies.set(TRADING_COOKIE, tradingToken, tradingCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TRADING_COOKIE, "", { ...tradingCookieOptions(), maxAge: 0 });
  return response;
}
