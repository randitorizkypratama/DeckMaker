# AGENTS.md — DuelDex

## Monorepo
- `bun` workspaces (`package.json:5`): `apps/*`, `packages/*`
- `apps/api` — Bun 1.1+ + Elysia 1.4 REST API (`apps/api/src/index.ts:40` guard `import.meta.main` — importing app does not start server)
- `apps/web` — Nuxt 4 + Vue 3.5 + Tailwind 4 (`apps/web/nuxt.config.ts:14` `runtimeConfig.public.apiBaseUrl`)
- `packages/shared` — single `workspace:*` source of truth for DTOs (`packages/shared/src/index.ts:1` exports `card.ts`, `deck.ts`, `api.ts`, `format-rules.ts`). Never duplicate types across apps.

## Commands (exact)
- Install: `bun install` (from repo root, resolves `packages/shared`)
- Dev both: `bun run dev` (root `package.json:10` fans out via `--filter '*'`)
- Dev single: `bun run dev:api` (3001) / `bun run dev:web` (3000) — web needs `NUXT_PUBLIC_API_BASE_URL` env
- Build web: `bun run build` (`apps/web` `nuxt build` -> `apps/web/.output/server/index.mjs`)
- Tests: `bun test` from `apps/api` (83 tests, `bun:test`). No frontend tests.
- Typecheck: `bunx tsc --noEmit` in `apps/api` or `packages/shared`. `bun run typecheck` at root runs both API+web but `apps/web` `nuxt typecheck` currently fails on `vue-router/volar/sfc-route-blocks` — use `bunx tsc --noEmit` in `apps/web` instead. `npx` fails on Windows PowerShell (ExecutionPolicy) — prefer `bunx`.
- Env setup: `cp apps/api/.env.example apps/api/.env` + `cp apps/web/.env.example apps/web/.env` — required vars `apps/api/src/config.ts:28` (`API_PORT`, `YGOPRODECK_API_URL`, `CORS_ORIGIN`, `PUBLIC_WEB_URL`, `DATABASE_PATH`, `UPSTREAM_TIMEOUT_MS`, `CACHE_TTL_MS`, `JWT_SECRET`)

## Architecture (non-obvious)
- Clean architecture, strict direction `presentation -> application -> domain <- infrastructure` (`README.md:117`). Domain has **zero** imports from `elysia`, `bun:sqlite`, or `ygoprodeck`. `apps/api/src/container.ts:1` is the only composition root — single `Database` singleton via `apps/api/src/infrastructure/db/database.ts:7` `getDatabase()` (WAL + `PRAGMA foreign_keys=ON`). For isolated tests use `createTestDatabase()` (`database.ts:21`), not the singleton.
- Frontend never calls YGOPRODeck. All via `apps/web/app/composables/useApi.ts:41` unwrapping `{success, data}` envelope and sending `Authorization: Bearer <JWT>`. Fallback `http://localhost:3001` if `NUXT_PUBLIC_API_BASE_URL` missing.
- JWT is custom HMAC-SHA256 `apps/api/src/infrastructure/auth/jwt.ts:21` (`signJwt`/`verifyJwt`), not `jsonwebtoken`/`jose`. Passwords via `Bun.password.hash/verify` (bcrypt cost 10) `apps/api/src/application/auth/AuthService.ts:59`.
- Persistence is SQLite (`bun:sqlite`). Migrations are inline `database.ts:35` — users adds `display_name/age/gender/country/avatar` via `ALTER TABLE`; decks adds `owner_id` + `is_public`; favorites migrated from `favorites(owner,card_id)` to `favorites(user_id,card_id)`. File `data/*.sqlite` is gitignored (`*sqlite*` in `.gitignore:11`) and ephemeral on Render free plan (`render.yaml:36` `/tmp/dueldex.sqlite`).

## API / Domain quirks
- YGOPRODeck returns **HTTP 400 with string `error`** for empty search — mapped to `[]` not error (`YgoProDeckClient.ts:46`). Every upstream call has `UPSTREAM_TIMEOUT_MS` abort -> `UPSTREAM_TIMEOUT`. In-process `TtlCache` (`infrastructure/cache/TtlCache.ts:1`) is required (rate-limit 20/s).
- Card data: raw `snake_case` `infrastructure/ygoprodeck/types.ts:16` -> `YgoProDeckMapper.ts:20` `mapCard` drops rows missing `id/name/type`; adds `banlist_info` -> `Card.banlist` (`card.ts:6`). `validateDeck` (`domain/deck/deck-rules.ts:197`) enforces real banlist (`Forbidden 0 / Limited 1 / Semi 2`) plus copy/section/size checks.
- Deck generation: `DeckGeneratorService.ts:34` `gatherCandidates` (archetype + text refs + staples + `findFormatPool`) -> `synergy-scoring.ts:1` (weights in `synergy-config.ts:1`) -> `deck-composer.ts:45` respects `banlistMax` and `maxCopiesPerCard`. Enforces 5 decks/user (`DeckService.ts:45` `enforceDeckLimit` via `countByOwner`).
- Favorites & decks are **per-user SQLite** (`favorites(user_id,card_id)` PK, `decks.owner_id` FK). `GET /api/favorites` and `GET /api/decks` require `Authorization` (401 otherwise). Public `GET /api/decks/:id` stays shareable.

## Frontend quirks
- Nuxt auto-imports `app/composables/*` — no manual imports needed. Shared state via `useState('dueldex-*')` (e.g., `useFavorites.ts:10`, `useAuth.ts:21`). Client-only logic gated by `import.meta.client` + `onMounted` (SSR has no `x-dueldex-owner`/`Authorization`).
- Filters: `useCards.ts:5` `CardFilters {search,type,attribute,level,archetype,race,atk,def,sort}` — backend supports `race/atk/def/sort` (`YgoProDeckRepository.ts:60`, `routes/cards.ts:10`) but only `race`/`atk`/`def`/`sort` were added later; `CardFilters.vue:1` drives them.
- Avatar: client-side WebP conversion `useAuth.ts:128` `convertToWebP` (`createImageBitmap` + `canvas.toBlob('image/webp',0.8)`, 5 MB limit) before `PUT /api/auth/me` (`routes/auth.ts:28`). Server also validates `data:image/webp;base64,` and 5 MB (`AuthService.ts:42` `validateAvatar`).
- Deck builder: `pages/deck/new.vue:126` handles `?editId=` (load via `GET /api/decks/:id` + `loadFromDeck`) and `?keyCard=&generate=1` (smart generate). Save dispatches `POST /api/decks` (new) vs `PUT /api/decks/:id` (edit, `savedDeckId` set). Limit UI reads `GET /api/decks` pagination (`{items, pagination}`) (`decks/index.vue:1` search/sort/page isPublic toggle).
- Deck stats: `DeckStats.vue:1` expects `DeckStats` with `levelCurve/atkHistogram/archetypeBreakdown/avgLevel/avgAtk` (`deck.ts:51`, computed in `deck-rules.ts:240` and locally in `pages/deck/new.vue:53`).

## Testing & verification
- Run `bun test` in `apps/api` only. `InMemoryDeckRepository.ts:1` is test-only; `Sqlite*Repository` constructors take `Database` instance, not path (common mistake after `database.ts` refactor).
- `bun test` uses fresh `createTestDatabase()` in helpers (`check_*.ts` temps) — do not reuse singleton in tests without `resetDatabaseSingleton()` (`database.ts:28`).
- No `opencode.json` / CI workflows in repo — `render.yaml:1` is the only deploy config (two services, `sync:false` vars `CORS_ORIGIN`, `PUBLIC_WEB_URL`, `NUXT_PUBLIC_API_BASE_URL` must be set manually after URLs known).

## Style
- `tsconfig.json:1` strict, `allowImportingTsExtensions: true`, `verbatimModuleSyntax`, `noEmit`. Imports use `.ts` extensions (`container.ts:1` style). No frontend `*.spec` tests.
