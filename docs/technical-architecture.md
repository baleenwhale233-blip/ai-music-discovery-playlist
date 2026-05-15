# Technical Architecture

## Workspace

The repository is a pnpm + Turborepo workspace.

```text
apps/
  web/     Mobile Web Alpha product
  api/     NestJS business API
  admin/   internal admin and debug tools
  mobile/  future native shell
packages/
  types/          shared domain types
  api-contract/   API schemas, DTOs, and response types
  config/         shared engineering config and env schema
infra/
  docker-compose.yml
docs/
```

Applications do not import code directly from other applications. Cross-app sharing goes through `packages/*`.

## Applications

### `apps/web`

Next.js Mobile Web product. It owns Alpha login, playlist listing, playlist creation, source-link add flow, playlist detail, local cache actions, and the player route.

It talks to the backend through `/api/v1` and shared contracts from `packages/api-contract`.

### `apps/api`

NestJS API. It owns authentication, source parsing, import previews, local audio cache, playlist data, audio Range responses, cover proxying, and health checks.

Current modules include `auth`, `contents`, `imports`, `playlists`, `health`, and platform services for Prisma, Redis, and queues.

### `apps/admin`

Internal admin and debug surface. It can host source and local-audio diagnostics, but it is not the Mobile Web Alpha product path.

### `apps/mobile`

Future native shell. It remains in the workspace for later native packaging and device-specific playback work.

## Shared Packages

### `packages/types`

Pure domain types, enums, and lightweight constants. It has no runtime side effects and does not contain business implementation.

### `packages/api-contract`

Zod schemas, DTOs, and inferred TypeScript types for API request and response boundaries.

### `packages/config`

Shared ESLint, TypeScript, Prettier, and environment schema utilities.

## API Boundary

The API prefix is `/api/v1`.

Stable cross-app semantics:

- Content key: `platform + platform_content_id`.
- Account verification statuses: `created`, `pending_user_action`, `pending_check`, `verified`, `rejected`, `expired`, `disputed`.
- Import candidate cache statuses: `uncached`, `caching`, `cached`, `failed`.
- Local audio asset statuses: `pending`, `caching`, `ready`, `failed`, `deleted`.

Frontend code should use `packages/api-contract` for request and response shapes instead of duplicating DTOs.

## Data Model

The Prisma schema uses PostgreSQL and includes these core models:

- `User`
- `SourceAccount`
- `SourceContent`
- `SourceCollection`
- `SourceCollectionItem`
- `Playlist`
- `PlaylistItem`
- `LocalAudioAsset`
- `ConversionTask`
- `Favorite`
- `PlayHistory`
- `ContentMeta`
- `ClaimOrVerificationTask`

The important Alpha relationships are:

- `SourceContent` stores parsed source metadata.
- `SourceCollection` and `SourceCollectionItem` store parsed collection candidates.
- `Playlist` and `PlaylistItem` represent user listening directories.
- `LocalAudioAsset` stores the personal cached audio asset for a user and source item.
- `ConversionTask` tracks cache, delete, refresh, and import work.

## Source Parsing

B 站 is the P0 source. The API parses source URLs into normalized source IDs and metadata, including:

- BVID.
- Canonical URL.
- Title.
- Cover URL.
- Owner name.
- Duration.
- Collection preview items for favorites, playlists, and medialists.

The source parsing implementation belongs in `apps/api`; shared packages only expose contracts and types.

## Local Audio Cache

Local audio caching is user initiated.

The API creates or updates `LocalAudioAsset` records and writes files under the configured local cache root. Cached assets include audio file metadata, optional cover cache metadata, cache status, and error details.

Conversion uses `yt-dlp` and `ffmpeg` in the current local/self-hosted setup. The architecture allows moving heavier conversion work to a separate worker without changing the Web product boundary.

## Playback

Playback uses cached audio assets served by the API. Audio endpoints support:

- `Range` requests.
- `206 Partial Content`.
- `Content-Range`.
- `Accept-Ranges: bytes`.

The Web player uses a real media element so play, pause, resume, duration, seek, and track-end behavior come from browser media APIs.

## Background Jobs

Redis and BullMQ are present as platform services and queue infrastructure. Alpha flows may still execute synchronously or with lightweight orchestration where that keeps local development simple.

`ConversionTask` is the domain record for cache, delete, metadata refresh, and collection import work. Queue usage should stay generic in platform code and keep business semantics in `apps/api` modules.

## Environment

Node 22 LTS is the recommended runtime. The repository pins the expected range through `.nvmrc`, `.node-version`, and `package.json` engines.

Workspace-level variables stay at the root. App-specific variables stay in each app's `.env.example`; for API development, start with `apps/api/.env.example`.

Local infrastructure is available through `infra/docker-compose.yml`. PostgreSQL is required for the API data model. Redis is supported for queue/cache coordination and may be optional for narrow local checks.

## Verification

Common workspace verification commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Alpha-specific helpers:

```bash
pnpm preflight:alpha
pnpm setup:alpha-db
pnpm dev:api
pnpm dev:web
pnpm verify:alpha-web
```

Clean-room local-audio scripts remain available for internal diagnostics:

```bash
pnpm dev:local-audio-clean
pnpm test:local-audio-clean
pnpm verify:local-audio-clean
```
