# Current State

## Implemented

- pnpm + Turborepo workspace with `apps/web`, `apps/api`, `apps/admin`, `apps/mobile`, and shared packages.
- Shared domain types in `packages/types`.
- API contracts and Zod schemas in `packages/api-contract`.
- Shared engineering config in `packages/config`.
- NestJS API with `/api/v1` prefix.
- API health endpoint.
- Alpha login request and verify flow.
- B 站 single-link parsing.
- B 站 favorite, playlist, medialist, and collection preview parsing.
- Import preview contracts, excluded item update contracts, and cache request contracts.
- Task-based local audio cache service.
- Local audio conversion task creation and status polling.
- In-process local audio worker for local-only conversion.
- Local audio temp and staging filesystem services with root containment checks.
- Local audio client-cache confirmation that deletes server staging artifacts.
- Local audio cleanup service for expired staging artifacts and stale temp dirs.
- Local audio playlist endpoint.
- Authenticated staging artifact download with Range support.
- Cover image proxying for B 站 images.
- Prisma schema for source content, source collections, playlists, playlist items, local audio assets, conversion tasks, favorites, play history, and content metadata.
- Redis and queue platform services.
- Mobile Web login page.
- Mobile Web playlist list.
- Mobile Web create-playlist draft flow.
- Mobile Web add-from-link flow.
- Mobile Web playlist detail page with selectable cache candidates.
- Mobile Web local player route for cached audio.
- Mobile Web profile page with drafts, published playlists, recent local cache, and logout.
- LocalStorage-backed Web playlist repository for current Web draft and published playlist prototype data.
- API-backed Web request layer for auth, source parsing, import preview, local audio cache, and local audio playlist operations.

## Partially Implemented

- Playlist publishing exists in the Web prototype repository and is not fully backed by persistent API playlist endpoints.
- `/playlists/[playlistId]` can trigger cache operations for parsed candidates, while richer playlist editing remains lightweight.
- SourceCollectionPreview semantics are represented through import preview contracts and API services, but the product flow still uses Web-local draft data in places.
- ConversionTask is now the persisted lifecycle record for local audio cache work. The default worker is in-process and local-only; Redis/BullMQ can remain infrastructure for later distributed workers.
- Redis and BullMQ infrastructure are present, but Redis is not a hard dependency for every local verification path.
- `apps/admin` provides internal/debug surfaces, not a polished admin product.
- `apps/mobile` exists as a native-shell reserve and is not part of Alpha verification.

## Not Implemented

- Public audio hosting.
- Public sharing of user cached audio files.
- Full native app release workflow.
- Heavy community features such as comments, follows, or social feeds.
- Full cloud conversion worker deployment.
- Complete backend-backed playlist CRUD for all Web prototype behavior.
- Full cache retry UI and detailed background job progress UI.
- Browser-side OPFS/IndexedDB/Cache API persistence and confirm-call wiring in the Web player.
- Production-ready source availability and regional rollout controls.

## Known Gaps

- Web draft and published playlist prototype data still relies on localStorage.
- YouTube is visible as an experimental source option in the add flow, but the Alpha import path is centered on B 站.
- Local audio worker depends on local tools such as `ffmpeg` and `yt-dlp` when real conversion is enabled. Unit tests use fake downloader/converter paths.
- Local verification may require PostgreSQL and app env setup.
- Debug and generated build artifacts can exist locally, but they are outside the authoritative product path.

## Next Steps

- Move playlist draft, publish, and detail operations behind persistent `/api/v1` endpoints.
- Connect Web playlist detail state directly to backend playlist and import models.
- Add clearer cache progress and retry behavior.
- Wire the Web player to download staging artifacts, save them to device-local storage, and call client-cache confirmation.
- Keep the player route aligned with playlist-specific cached queues.
- Decide when to promote queue-backed conversion from infrastructure to the default Alpha path.
- Add focused end-to-end smoke coverage for login, add link, publish, cache, and player playback.

## Verification Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:alpha-web
```

Environment checks and setup:

```bash
pnpm preflight:alpha
pnpm setup:alpha-db
```
