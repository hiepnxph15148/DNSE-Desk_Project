"use client";

import { signIn } from "next-auth/react";

type Props = { googleReady: boolean; callbackUrl: string; error?: string };

function loginError(code?: string) {
  if (!code) return "";
  if (code === "OAuthCallback" || code === "OAuthSignin") {
    return "Google từ chối bước callback (thường do Client Secret sai hoặc đã đổi trên Cloud Console). Tạo lại secret, dán vào GOOGLE_CLIENT_SECRET, restart npm run dev, rồi thử lại.";
  }
  if (code === "AccessDenied") return "Tài khoản Google này chưa được thêm vào danh sách người dùng thử nghiệm.";
  if (code === "Configuration") return "Chưa cấu hình đủ Google OAuth.";
  return "Đăng nhập Google chưa thành công. Thử lại.";
}

export function LoginPanel({ googleReady, callbackUrl, error }: Props) {

  return (
    <section className="login-panel panel">
      <div className="brand">
        <div className="mark" aria-hidden="true">Đ</div>
        <div>
          <h1>DNSE Desk</h1>
          <p>Đăng nhập để mở bàn giao dịch</p>
        </div>
      </div>
      {loginError(error) ? <p className="login-note" role="alert">{loginError(error)}</p> : null}
      {!googleReady ? (
        <p className="login-note" role="status">
          Chưa cấu hình Google OAuth. Thêm <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> và <code>NEXTAUTH_SECRET</code> vào <code>.env.local</code>.
        </p>
      ) : null}
      <button
        className="google-signin"
        type="button"
        disabled={!googleReady}
        onClick={() => void signIn("google", { callbackUrl })}
      >
        <span className="google-mark" aria-hidden="true">G</span>
        Đăng nhập bằng Google
      </button>
    </section>
  );
}
