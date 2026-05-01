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
    <main className="mobile-shell center-shell">
      <section className="surface login-card auth-card">
        <p className="eyebrow">Invite Alpha</p>
        <div className="auth-copy">
          <h1>轻一点进来，重一点听歌。</h1>
          <p className="lead">登录后进入听单广场、创建目录、缓存自己的本地音频，并继续用真实播放器收听。</p>
        </div>
        <div className="auth-form">
          <label>
            账号
            <input
              autoComplete="email"
              onChange={(event) => setPhoneOrEmail(event.target.value)}
              placeholder="手机号或邮箱"
              value={phoneOrEmail}
            />
          </label>
          <label>
            邀请码
            <input
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="例如 alpha-50"
              value={inviteCode}
            />
          </label>
          <label>
            验证码
            <input
              inputMode="numeric"
              onChange={(event) => setCode(event.target.value)}
              placeholder="例如 246810"
              value={code}
            />
          </label>
        </div>
        <div className="actions">
          <button className="primary" disabled={busy || !phoneOrEmail || !inviteCode || !code} onClick={handleLogin}>登录</button>
          <Link className="button secondary" href="/playlists">返回听单广场</Link>
        </div>
        <div className="status">{status}</div>
      </section>
    </main>
  );
}
