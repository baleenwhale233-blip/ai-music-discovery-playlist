# Current State

## Implemented

- pnpm + Turborepo workspace with `apps/web`, `apps/api`, `apps/admin`, `apps/mobile`, and shared packages.
- Shared domain types in `packages/types`.
- API contracts and Zod schemas in `packages/api-contract`.
- Shared engineering config in `packages/config`.
- NestJS API with `/api/v1` prefix.
- API health endpoint.
- Alpha login request and verify flow.
- Current alpha user profile endpoint.
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
- Persistent playlist list, create, detail, update, item add/remove, playlist favorite, and `/me` library API contracts and handlers.
- Cover image proxying for B 站 images.
- Playlist favorites table for current-user playlist collection state.
- Prisma schema for source content, source collections, playlists, playlist items, local audio assets, conversion tasks, favorites, play history, and content metadata.
- Redis and queue platform services.
- Mobile Web login page.
- Mobile Web playlist list.
- Mobile Web create-playlist draft flow.
- Mobile Web add-from-link flow.
- Mobile Web playlist detail page with selectable cache candidates.
- Mobile Web playlist management route for owner title, description, and item deletion.
- Mobile Web global player route for cached audio queue playback.
- Mobile Web global mini player fixed above bottom navigation.
- Mobile Web profile page with drafts, published playlists, recent local cache, and logout.
- LocalStorage-backed Web draft repository for temporary create flow state.
- API-backed Web request layer for auth, source parsing, import preview, persistent playlists, favorites, local audio cache, and local audio playlist operations.

## Partially Implemented

- Playlist publishing now creates persistent API playlists from the browser draft, while richer add-to-existing and reorder management remains lightweight.
- `/playlists/[playlistId]` can trigger cache operations for playlist items and build a global player queue from cached items.
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
- Complete backend-backed playlist reorder and delete-playlist behavior.
- Full cache retry UI and detailed background job progress UI.
- Browser-side OPFS/IndexedDB/Cache API persistence and confirm-call wiring in the Web player.
- Production-ready source availability and regional rollout controls.

## Known Gaps

- Web draft data still uses localStorage as temporary browser state.
- Existing playlist management does not yet include add-from-link directly inside `/playlists/[playlistId]/manage`.
- Public Alpha add flow exposes B 站 only; other sources remain technical experiments.
- Local audio worker depends on local tools such as `ffmpeg` and `yt-dlp` when real conversion is enabled. Unit tests use fake downloader/converter paths.
- Local verification may require PostgreSQL and app env setup.
- Debug and generated build artifacts can exist locally, but they are outside the authoritative product path.

## Next Steps

- Add owner add-from-link and reorder operations directly inside `/playlists/[playlistId]/manage`.
- Add clearer cache progress polling and retry behavior.
- Wire the Web player to save staging artifacts to device-local storage and call client-cache confirmation.
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
