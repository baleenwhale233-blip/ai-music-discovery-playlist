# Decisions

This file records current effective product and architecture decisions. It is not a chronological development log.

## Product Boundary

- The Alpha product is Mobile Web First: users organize source links into playlists, actively cache personal local audio assets, and play cached audio through a real media element.
- B 站 is the P0 source for the Alpha path. Other sources may exist as experiments but are not the default public Alpha path.
- Cached audio is personal to the current user and backend environment. The product does not provide public audio hosting, public sharing of cached files, or cross-user audio file reuse.
- The system must not accept user cookies or bypass DRM, membership, paid access, login requirements, access controls, or regional restrictions.

## Local Audio Conversion

- Local audio caching is task-based. Cache requests create or reuse a `LocalAudioAsset`, create a `ConversionTask`, return immediately, and rely on task status polling rather than long-running HTTP requests.
- The default backend worker mode is local-only and in-process. Redis/BullMQ remain platform infrastructure for future distributed workers but are not required for the narrow local conversion path.
- `ConversionTask` is the persisted lifecycle record for cache work. `LocalAudioAsset` is the persisted lifecycle record for the user's personal audio asset metadata.
- Server filesystem state has two short-lived layers:
  - task temp files under `LOCAL_AUDIO_TEMP_ROOT`, keyed by task id.
  - final staging artifacts under `LOCAL_AUDIO_STAGING_ROOT`, keyed by asset id and generated artifact id.
- Worker success or failure must delete source downloads, source audio/video streams, fragments, intermediate files, and ffmpeg temp files. Only the final staging artifact survives a successful worker run.
- The final staging artifact is deleted after the client confirms local device storage with matching `sha256` and `sizeBytes`, or after staging TTL cleanup.
- After successful client confirmation, `LocalAudioAsset.storageType` becomes `USER_DEVICE`, `relativeFilePath` is cleared, and the server keeps only metadata such as hash, size, duration, mime type, and confirmation timestamps.

## API And Contracts

- Frontend and API boundaries should use `packages/api-contract`; Web/API should not maintain parallel DTO definitions.
- The formal local audio download path is asset-based: `/api/v1/local-audio/assets/:assetId/download`.
- The old formal `cacheKey` audio serving route is superseded by the asset download route. `cacheKey` can remain internal metadata but should not be the main download API identity.
- Cache request and import cache responses should return task/asset identifiers and queued status, not pretend conversion has completed synchronously.
- Internal cleanup may be exposed by a debug/internal endpoint during local development, but it must not be a normal user-facing endpoint.

## Documentation And Context

- Repository docs should stay layered:
  - `README.md` for entry and commands.
  - `docs/product.md`, `docs/web-ia.md`, and `docs/technical-architecture.md` for product and architecture.
  - `docs/current-state.md` for the rolling implementation snapshot.
  - this file for long-lived decisions.
- Do not add broad chronological development logs. Temporary process history belongs in PRs, commits, and review notes.
