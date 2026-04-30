"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "../../../components/bottom-nav";
import { LoginPrompt } from "../../../components/login-prompt";
import { PageHeader } from "../../../components/page-header";
import { getStoredToken, previewImport } from "../../../../lib/api";
import { createPlaylistRepository } from "../../../../lib/playlist-repository-factory";

export default function AddPlaylistVideoPage() {
  const router = useRouter();
  const repository = useMemo(() => createPlaylistRepository(), []);
  const [tokenReady, setTokenReady] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState("贴入 B 站单条、合集、收藏夹或播放列表链接。");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTokenReady(Boolean(getStoredToken()));
  }, []);

  async function handlePreview() {
    if (!sourceUrl.trim()) {
      setStatus("先贴入一个 B 站链接。");
      return;
    }

    setBusy(true);
    setStatus("正在解析链接，解析完成后会回到听单草稿。");

    try {
      const preview = await previewImport({ url: sourceUrl.trim() });
      await repository.appendImportPreviewToDraft(preview);
      router.push("/playlists/new");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "解析失败");
    } finally {
      setBusy(false);
    }
  }

  if (!tokenReady) {
    return <LoginPrompt />;
  }

  return (
    <main className="mobile-shell with-bottom-nav">
      <PageHeader
        actionHref="/playlists/new"
        actionLabel="返回草稿"
        description="这里只负责解析链接，不在这里做复杂筛选。解析结果会进入上一页的等待保存列表。"
        eyebrow="Add Source"
        title="添加视频"
      />

      <section className="surface draft-editor">
        <label>
          <span>视频或合集地址</span>
          <textarea
            autoFocus
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://www.bilibili.com/video/BV... 或收藏夹 /list/ml..."
            value={sourceUrl}
          />
        </label>
        <div className="toolbar">
          <button disabled={busy} onClick={() => void handlePreview()}>解析并加入草稿</button>
          <Link className="button secondary" href="/playlists/new">取消</Link>
        </div>
        <div className="status">{status}</div>
      </section>

      <BottomNav />
    </main>
  );
}
