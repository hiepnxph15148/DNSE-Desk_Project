import { NextResponse, type NextRequest } from "next/server";
import { dnseRequest } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";
import { readAccounts, readBalance, readOrders, readPositions } from "@/lib/dnse/normalize";
import { parseAccount, parseMarketType } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const marketType = parseMarketType(
    request.nextUrl.searchParams.get("marketType") ?? process.env.DNSE_MARKET_TYPE,
  );
  const requested = request.nextUrl.searchParams.get("accountNo");
  const accountNo = requested ? parseAccount(requested) : null;
  if (requested && !accountNo) {
    return NextResponse.json({ error: "Số tiểu khoản không hợp lệ." }, { status: 400 });
  }

  try {
    const accounts = readAccounts(await dnseRequest("/accounts"));
    const selected = accountNo && accounts.some((item) => item.id === accountNo)
      ? accountNo
      : accounts[0]?.id ?? null;

    if (!selected) {
      return NextResponse.json({
        accounts,
        accountNo: null,
        balance: { availableCash: null, totalCash: null },
        orders: [],
        positions: [],
        marketType,
      });
    }

    const orderQuery = new URLSearchParams({
      marketType,
      orderCategory: "NORMAL",
      pageIndex: "1",
      pageSize: "50",
    });
    const positionQuery = new URLSearchParams({ marketType, pageSize: "50" });
    const [balanceBody, orderBody, positionBody] = await Promise.all([
      dnseRequest(`/accounts/${selected}/balances`),
      dnseRequest(`/accounts/${selected}/orders?${orderQuery.toString()}`).catch(() => ({ orders: [] })),
      dnseRequest(`/accounts/${selected}/positions?${positionQuery.toString()}`).catch(() => ({ positions: [] })),
    ]);

    return NextResponse.json({
      accounts,
      accountNo: selected,
      balance: readBalance(balanceBody),
      orders: readOrders(orderBody),
      positions: readPositions(positionBody),
      marketType,
    });
  } catch (error) {
    return jsonError(error);
  }
}
