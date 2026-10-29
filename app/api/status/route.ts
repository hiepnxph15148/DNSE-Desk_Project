import { NextResponse, type NextRequest } from "next/server";
import { credentialStatus, dnseRequest } from "@/lib/dnse/client";
import { jsonError, TRADING_COOKIE } from "@/lib/dnse/http";
import { readAccounts } from "@/lib/dnse/normalize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = credentialStatus();
  const tradingToken = Boolean(request.cookies.get(TRADING_COOKIE)?.value);

  if (!config.hasKey || !config.hasSecret) {
    return NextResponse.json({
      ok: false,
      code: "CONFIG",
      tradingToken,
      ...config,
      error: config.hasKey
        ? "Đã có API Key. Thêm DNSE_API_SECRET vào .env.local rồi chạy lại server."
        : "Thiếu DNSE_API_KEY và DNSE_API_SECRET trong .env.local.",
    });
  }

  try {
    const accounts = readAccounts(await dnseRequest("/accounts"));
    return NextResponse.json({
      ok: true,
      tradingToken,
      ...config,
      accountCount: accounts.length,
    });
  } catch (error) {
    const response = jsonError(error);
    const payload = await response.json();
    return NextResponse.json({ ok: false, tradingToken, ...config, ...payload }, { status: response.status });
  }
}
