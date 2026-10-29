import { NextResponse, type NextRequest } from "next/server";
import { dnseRequest } from "@/lib/dnse/client";
import { jsonError, TRADING_COOKIE } from "@/lib/dnse/http";
import {
  parseAccount,
  parseMarketType,
  parseOrderId,
  parseOrderType,
  parsePrice,
  parseQuantity,
  parseSide,
  parseSymbol,
} from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requireToken(request: NextRequest) {
  const token = request.cookies.get(TRADING_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Cần Smart OTP hoặc Email OTP trước khi gửi lệnh." },
      { status: 401 },
    );
  }
  return token;
}

export async function POST(request: NextRequest) {
  const token = requireToken(request);
  if (token instanceof NextResponse) return token;

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const accountNo = parseAccount(typeof payload?.accountNo === "string" ? payload.accountNo : null);
  const symbol = parseSymbol(typeof payload?.symbol === "string" ? payload.symbol : null);
  const side = parseSide(typeof payload?.side === "string" ? payload.side : null);
  const orderType = parseOrderType(typeof payload?.orderType === "string" ? payload.orderType : null);
  const quantity = parseQuantity(payload?.quantity);
  const price = parsePrice(payload?.price);
  const marketType = parseMarketType(typeof payload?.marketType === "string" ? payload.marketType : null);
  const loanPackageId = Number(payload?.loanPackageId);

  if (!accountNo || !symbol || !side || !orderType || quantity == null || price == null) {
    return NextResponse.json({ error: "Thông tin lệnh chưa hợp lệ." }, { status: 400 });
  }
  if (orderType === "LO" && price <= 0) {
    return NextResponse.json({ error: "Lệnh LO cần giá lớn hơn 0." }, { status: 400 });
  }
  if (!Number.isInteger(loanPackageId) || loanPackageId < 0) {
    return NextResponse.json({ error: "Chọn gói vay trước khi gửi lệnh." }, { status: 400 });
  }

  const query = new URLSearchParams({ marketType, orderCategory: "NORMAL" });
  try {
    const created = await dnseRequest(`/accounts/orders?${query.toString()}`, {
      method: "POST",
      tradingToken: token,
      json: {
        accountNo,
        symbol,
        side,
        orderType,
        price,
        quantity,
        loanPackageId,
      },
    });
    return NextResponse.json({ order: created });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const token = requireToken(request);
  if (token instanceof NextResponse) return token;

  const accountNo = parseAccount(request.nextUrl.searchParams.get("accountNo"));
  const orderId = parseOrderId(request.nextUrl.searchParams.get("orderId"));
  const marketType = parseMarketType(request.nextUrl.searchParams.get("marketType"));
  if (!accountNo || !orderId) {
    return NextResponse.json({ error: "Không xác định được lệnh cần hủy." }, { status: 400 });
  }

  const query = new URLSearchParams({ marketType, orderCategory: "NORMAL" });
  try {
    await dnseRequest(`/accounts/${accountNo}/orders/${orderId}?${query.toString()}`, {
      method: "DELETE",
      tradingToken: token,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
