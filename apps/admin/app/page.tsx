const cards = [
  { title: "内容查看", body: "后续接入内容列表、来源筛选和状态过滤。" },
  { title: "精选歌单", body: "后续接入推荐位、排序和上下架。" },
  { title: "账号验证", body: "后续接入验证码验证任务与人工复核。" },
  { title: "B 站外链调试页", body: "验证来源播放器嵌入和解析链路。", href: "/debug/bilibili" },
  { title: "本地音频实验页", body: "验证视频转本地音频后用原生 audio 播放。", href: "/debug/local-audio" }
];

export default function HomePage() {
  return (
    <main
      style={{
        padding: "48px 32px",
        display: "grid",
        gap: 24
      }}
    >
      <section style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>内部后台骨架</p>
        <h1 style={{ margin: 0, fontSize: 32 }}>大陆版 MVP 管理台</h1>
        <p style={{ margin: 0, maxWidth: 680, color: "#334155", lineHeight: 1.6 }}>
          当前阶段只提供布局和信息架构占位，后续会逐步接入内容查看、验证任务、争议处理与运营配置。
        </p>
      </section>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}
      >
        {cards.map((card) => {
          const content = (
            <article
              key={card.title}
              style={{
                padding: 20,
                borderRadius: 20,
                background: "rgba(255,255,255,0.9)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                minHeight: 150
              }}
            >
              <h2 style={{ marginTop: 0 }}>{card.title}</h2>
              <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.6 }}>{card.body}</p>
            </article>
          );

          if (!("href" in card)) {
            return content;
          }

          return (
            <a key={card.title} href={card.href} style={{ display: "block" }}>
              {content}
            </a>
          );
        })}
      </section>
    </main>
  );
}
