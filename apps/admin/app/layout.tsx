import "./globals.css";

import type { ReactNode } from "react";

export const metadata = {
  title: "AI Music Discovery Admin",
  description: "Internal admin shell for the mainland MVP"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
