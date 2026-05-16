# AI Music Discovery & Playlist

面向大陆用户的 Mobile Web First AI 音乐目录与本地听单工具。

用户可以从 B 站等来源添加链接，整理成听单目录，并在主动确认后缓存为个人本地音频资产。播放发生在缓存完成之后，基于真实 media element 支持连续收听。

## Current Alpha Scope

- Alpha 登录。
- B 站链接解析。
- B 站收藏夹、播放列表、合集候选解析。
- 创建和发布听单目录。
- 用户主动缓存目录条目。
- 本地音频资产播放、暂停、继续、进度拖动和连续播放。
- 内部后台与调试入口。

## Workspace

- `apps/web`: Mobile Web Alpha product.
- `apps/api`: business API, source parsing, local cache, Range audio responses, playlist data.
- `apps/admin`: internal admin and debug tools.
- `apps/mobile`: future native shell, outside the current Alpha path.
- `packages/types`: shared domain types.
- `packages/api-contract`: API contracts, DTOs, and schemas.
- `packages/config`: shared engineering config and env schema.

## Requirements

- Node 22 LTS.
- pnpm 9.15.x.
- PostgreSQL for API-backed local development.
- `ffmpeg` and `yt-dlp` for local audio caching flows.
- Redis is supported for queue/cache coordination and may be optional for narrow local checks.

The repository pins the expected Node range through `.nvmrc`, `.node-version`, and `package.json`.

## Quick Start

```bash
pnpm install
pnpm preflight:alpha
pnpm setup:alpha-db
pnpm dev:api
pnpm dev:web
```

The Mobile Web app runs at:

```text
http://127.0.0.1:3020
```

The API runs at:

```text
http://127.0.0.1:4000/api/v1
```

Default local Alpha login values are documented in `apps/api/.env.example`.

## Common Commands

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:admin
pnpm preflight:alpha
pnpm setup:alpha-db
pnpm verify:alpha-web
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:alpha-web
```

## Documentation

- Product: [docs/product.md](docs/product.md)
- Web IA: [docs/web-ia.md](docs/web-ia.md)
- Technical Architecture: [docs/technical-architecture.md](docs/technical-architecture.md)
- Current State: [docs/current-state.md](docs/current-state.md)
- Decisions: [docs/decisions.md](docs/decisions.md)

## Out of Scope

- Public audio hosting.
- Public sharing of user cached audio files.
- Heavy community features such as comments, follows, or social feeds.
- Copyright ownership certification.
- Complete native app distribution.
