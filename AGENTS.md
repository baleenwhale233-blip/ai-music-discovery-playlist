# AGENTS.md

This repository is currently focused on the Mobile Web Alpha for AI Music Discovery & Playlist.

## Read First

1. `README.md`
2. `docs/product.md`
3. `docs/web-ia.md`
4. `docs/technical-architecture.md`
5. `docs/current-state.md`
6. `git status --short`

## Product Direction

The current product is a Mobile Web First music directory and local playlist tool. Users add source links, organize them into playlists, actively cache personal local audio assets, and play cached audio through a real media element.

## Workspace Boundaries

- `apps/web`: Mobile Web product.
- `apps/api`: business API.
- `apps/admin`: internal admin and debug tools.
- `apps/mobile`: future native shell, outside the current Alpha path.
- `packages/types`: shared domain types.
- `packages/api-contract`: API contracts and DTOs.
- `packages/config`: shared configuration and env schema.

## Development Rules

- Do not import code directly between `apps/*`.
- Share cross-app code through `packages/*`.
- Keep business logic in `apps/api` where possible.
- Keep `apps/web` aligned with `/api/v1` and `packages/api-contract`.
- Keep `packages/types` limited to pure types, enums, and lightweight constants.
- Keep `packages/api-contract` limited to schemas, DTOs, and API boundary types.
- Keep `packages/config` limited to engineering configuration and env schema.
- Do not add `packages/ui` in the current Alpha phase unless explicitly requested.

## Verification

Use the narrowest relevant checks while working, then run the broader workspace checks before handing off meaningful changes.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Alpha-specific checks:

```bash
pnpm preflight:alpha
pnpm setup:alpha-db
pnpm verify:alpha-web
```
