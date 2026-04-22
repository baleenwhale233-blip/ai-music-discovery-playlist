import { getAuthShellState } from "../../lib/auth";

export default function LoginPage() {
  const authState = getAuthShellState();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 32,
          borderRadius: 24,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(148, 163, 184, 0.2)"
        }}
      >
        <p style={{ marginTop: 0, color: "#475569" }}>登录壳页</p>
        <h1>手机号验证码登录</h1>
        <p style={{ color: "#475569", lineHeight: 1.6 }}>
          当前只保留后续对接真实短信服务的边界。默认模式：{authState.mode}
        </p>
      </section>
    </main>
  );
}
