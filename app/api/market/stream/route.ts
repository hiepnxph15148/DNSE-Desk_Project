import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Giá realtime dùng WebSocket ws://<host>:3003/api/market/ws?symbols=..." },
    { status: 410 },
  );
}
