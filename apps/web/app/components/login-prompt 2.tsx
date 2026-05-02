import Link from "next/link";

export function LoginPrompt() {
  return (
    <main className="mobile-shell center-shell">
      <section className="surface login-card">
        <p className="eyebrow">Alpha</p>
        <h1>先登录，再整理你的听单。</h1>
        <p className="lead">登录后可以进入听单广场、创建目录、缓存自己的本地音频，并继续使用真实播放器收听。</p>
        <Link className="button primary" href="/login">进入 Alpha 登录</Link>
      </section>
    </main>
  );
}
