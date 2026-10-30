"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useId, useRef, useState } from "react";

function UserAvatar({ image, name, className }: { image?: string | null; name: string; className?: string }) {
  if (image) {
    return (
      <img
        className={className}
        src={image}
        alt=""
        width={28}
        height={28}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`${className ?? ""} user-avatar-badge`} aria-hidden="true">
      {initial}
    </span>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconFeedback() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h16v10H7l-3 3V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 7V5a1 1 0 0 1 1-1h8v16h-8a1 1 0 0 1-1-1v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 12H4m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserMenu() {
  const { data } = useSession();
  const user = data?.user;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const displayName = user?.name?.trim() || user?.email?.trim() || "Tài khoản";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={displayName}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-menu-avatar-wrap">
          <UserAvatar image={user.image} name={displayName} className="user-avatar" />
          <span className="user-plan-pill">BASIC</span>
        </span>
      </button>

      {open ? (
        <div className="user-menu-popover panel" id={menuId} role="menu">
          <div className="user-menu-profile">
            <UserAvatar image={user.image} name={displayName} className="user-avatar user-avatar-lg" />
            <p className="user-menu-fullname">{displayName}</p>
            <p className="user-menu-plan">Gói cơ bản</p>
            <span className="user-menu-rank">Hạng Đồng</span>
            <p className="user-menu-points">3 điểm hoạt động · còn 47 lên Bạc</p>
          </div>
          <ul className="user-menu-list">
            <li role="none">
              <button type="button" className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
                <IconUser />
                Hồ sơ cá nhân
              </button>
            </li>
            <li role="none">
              <button type="button" className="user-menu-item" role="menuitem" onClick={() => setOpen(false)}>
                <IconFeedback />
                Góp ý / Báo lỗi
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                className="user-menu-item"
                role="menuitem"
                onClick={() => void signOut({ callbackUrl: "/login" })}
              >
                <IconLogout />
                Đăng xuất
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
