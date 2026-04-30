"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/playlists",
    label: "听单",
    match: (pathname: string) => pathname === "/" || pathname === "/playlists" || /^\/playlists\/[^/]+$/.test(pathname)
  },
  {
    href: "/me",
    label: "我的",
    match: (pathname: string) => pathname.startsWith("/me") || pathname === "/playlist"
  }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航" className="bottom-nav">
      <Link className={items[0]?.match(pathname) ? "bottom-nav-item active" : "bottom-nav-item"} href="/playlists">
        <span className="nav-icon">≡</span>
        <span>听单</span>
      </Link>
      <Link aria-label="添加听单" className="bottom-nav-add" href="/playlists/new">
        <span>+</span>
      </Link>
      <Link className={items[1]?.match(pathname) ? "bottom-nav-item active" : "bottom-nav-item"} href="/me">
        <span className="nav-icon">•</span>
        <span>我的</span>
      </Link>
    </nav>
  );
}
