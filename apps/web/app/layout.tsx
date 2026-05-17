import type { Metadata } from "next";
import type { ReactNode } from "react";

import { MiniPlayer } from "./components/mini-player";
import { PlayerProvider } from "./components/player-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "视频转音频听单",
  description: "Mobile Web First 的视频转音频目录与本地听单"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <PlayerProvider>
          {children}
          <MiniPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
