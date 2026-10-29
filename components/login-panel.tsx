"use client";

import { signIn } from "next-auth/react";

type Props = { googleReady: boolean; callbackUrl: string };

export function LoginPanel({ googleReady, callbackUrl }: Props) {

  return (
    <section className="login-panel panel">
      <div className="brand">
        <div className="mark" aria-hidden="true">Đ</div>
        <div>
          <h1>DNSE Desk</h1>
          <p>Đăng nhập để mở bàn giao dịch</p>
        </div>
      </div>
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
