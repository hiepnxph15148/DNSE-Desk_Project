import { NextResponse, type NextRequest } from "next/server";
import { dnseRequest } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";
import { readLoanPackages, readPower } from "@/lib/dnse/normalize";
import { parseAccount, parseMarketType, parsePrice, parseSymbol } from "@/lib/dnse/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const accountNo = parseAccount(request.nextUrl.searchParams.get("accountNo"));
  const symbol = parseSymbol(request.nextUrl.searchParams.get("symbol"));
  if (!accountNo || !symbol) {
    return NextResponse.json({ error: "Thiếu tiểu khoản hoặc mã hợp lệ." }, { status: 400 });
  }

  const marketType = parseMarketType(request.nextUrl.searchParams.get("marketType"));
  const price = parsePrice(request.nextUrl.searchParams.get("price")) ?? 0;
  const loanPackageId = request.nextUrl.searchParams.get("loanPackageId")?.trim() ?? "";

  try {
    const packages = readLoanPackages(await dnseRequest(
      `/accounts/${accountNo}/loan-packages?${new URLSearchParams({ marketType, symbol }).toString()}`,
    ));

    let power = { buyingPower: null as number | null, sellingPower: null as number | null };
    const packageId = loanPackageId || packages[0]?.id || "";
    if (packageId && /^\d+$/.test(packageId)) {
      const params = new URLSearchParams({
        marketType,
        symbol,
        price: String(price),
        loanPackageId: packageId,
      });
      power = readPower(await dnseRequest(`/accounts/${accountNo}/ppse?${params.toString()}`).catch(() => ({})));
    }

    return NextResponse.json({ loanPackages: packages, power, loanPackageId: packageId });
  } catch (error) {
    return jsonError(error);
  }
}
