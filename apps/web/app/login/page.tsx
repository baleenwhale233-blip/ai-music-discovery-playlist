"use client";

import Link from "next/link";
import { useState } from "react";

import { login, storeToken } from "../../lib/api";

export default function LoginPage() {
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("使用 alpha 邀请码和占位验证码登录。");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setStatus("正在进入 Alpha...");

    try {
      const result = await login({
        phoneOrEmail,
        inviteCode,
        code
      });
      storeToken(result.accessToken);
      setStatus(`已登录：${result.user?.nickname ?? phoneOrEmail}`);
      window.location.href = "/";
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="login-card panel">
        <p className="eyebrow">Invite Alpha</p>
        <h1>轻一点进来，重一点听歌。</h1>
        <p className="lead">第一版只做简单登录隔离：每个账号有自己的导入、缓存和听单。默认本地验证码可在 `apps/api/.env.example` 里看到。</p>
        <div className="stack">
          <input
            autoComplete="email"
            onChange={(event) => setPhoneOrEmail(event.target.value)}
            placeholder="手机号或邮箱"
            value={phoneOrEmail}
          />
          <input
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="邀请码，例如 alpha-50"
            value={inviteCode}
          />
          <input
            inputMode="numeric"
            onChange={(event) => setCode(event.target.value)}
            placeholder="验证码，例如 246810"
            value={code}
          />
        </div>
        <div className="actions">
          <button disabled={busy || !phoneOrEmail || !inviteCode || !code} onClick={handleLogin}>登录</button>
          <Link className="button secondary" href="/playlists">返回听单广场</Link>
        </div>
        <div className="status">{status}</div>
      </section>
    </main>
  );
}
