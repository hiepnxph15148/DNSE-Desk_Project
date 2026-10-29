"use client";

import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const { data } = useSession();
  const user = data?.user;
  if (!user) return null;

  const label = user.name ?? user.email ?? "Tài khoản";

  return (
    <div className="user-menu">
      {user.image ? <img className="user-avatar" src={user.image} alt="" /> : <span className="user-avatar user-avatar-fallback" aria-hidden="true">{label.slice(0, 1).toUpperCase()}</span>}
      <span className="user-name">{label}</span>
      <button className="user-signout" type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>
        Thoát
      </button>
    </div>
  );
}
