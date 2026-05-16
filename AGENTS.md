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

## Context Management

Use layered context instead of a chronological development log.

- Entry layer: `README.md` explains what the repository is and how to run it.
- Product layer: `docs/product.md`, `docs/web-ia.md`, and `docs/technical-architecture.md` define the current product, IA, and architecture.
- Snapshot layer: `docs/current-state.md` is the rolling implementation snapshot. Update it after meaningful work by rewriting the current facts, not by appending a dated journal.
- Decision layer: long-lived product or architecture decisions should be captured as current effective decisions. If a decision needs its own durable record, add or update `docs/decisions.md` or an ADR under `docs/adr/`.
- Handoff layer: use `git status --short` plus the current diff to understand active WIP. Treat existing uncommitted changes as intentional unless they directly conflict with the task.

Do not recreate a broad chronological journal. PR descriptions, commit messages, and review notes should carry temporary process history; repository docs should carry current facts and still-active decisions.

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
