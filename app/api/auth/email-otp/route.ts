import { NextResponse } from "next/server";
import { dnseRequest } from "@/lib/dnse/client";
import { jsonError } from "@/lib/dnse/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    await dnseRequest("/registration/send-email-otp", { method: "POST" });
    return NextResponse.json({
      ok: true,
      message: "Đã gửi OTP tới email đăng ký với DNSE. Mã dùng một lần và hết hạn nhanh.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
