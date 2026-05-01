import type { ReactNode } from "react";
import type { DraftPlaylistItem, PublishedPlaylistItem } from "../../lib/playlist-domain";
import { buildMediaUrl } from "../../lib/api";

type Item = DraftPlaylistItem | PublishedPlaylistItem;

export function PlaylistItemRow(props: {
  item: Item;
  checked?: boolean;
  selectable?: boolean;
  disabled?: boolean;
  onToggle?: (id: string, checked: boolean) => void;
  actions?: ReactNode;
}) {
  const coverUrl = buildMediaUrl(props.item.coverUrl);

  return (
    <article className="item-row">
      {props.selectable ? (
        <input
          aria-label="选择条目"
          checked={Boolean(props.checked)}
          disabled={props.disabled}
          onChange={(event) => props.onToggle?.(props.item.id, event.target.checked)}
          type="checkbox"
        />
      ) : null}
      {coverUrl ? <img className="item-cover" src={coverUrl} alt="" /> : <div className="item-cover" />}
      <div className="item-content">
        <strong>{props.item.title}</strong>
        <span>
          {props.item.ownerName ?? "未知作者"} / {formatDuration(props.item.durationSeconds)} / {renderCacheStatus(props.item.cacheStatus)}
        </span>
      </div>
      {props.actions ? <div className="item-actions">{props.actions}</div> : null}
    </article>
  );
}

function formatDuration(durationSeconds: number | null) {
  if (!durationSeconds) {
    return "未知时长";
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderCacheStatus(status: Item["cacheStatus"]) {
  const labels: Record<Item["cacheStatus"], string> = {
    cached: "已缓存",
    caching: "缓存中",
    failed: "缓存失败",
    uncached: "未缓存"
  };

  return labels[status];
}
