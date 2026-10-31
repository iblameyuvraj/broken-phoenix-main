---
kind: configuration_system
name: Zod-Validated Environment Configuration with Fail-Fast Startup
category: configuration_system
scope:
    - '**'
source_files:
    - phoenix-backend/src/config.ts
    - phoenix-backend/src/server.ts
    - phoenix-backend/src/db.ts
    - phoenix-backend/.env.example
    - phoenix-frontend/.env.example
    - phoenix-backend/vercel.json
    - phoenix-frontend/next.config.mjs
---

## Approach

The Phoenix backend uses a **single-source-of-truth environment configuration** pattern built on `zod` for runtime schema validation. There is no `.env` loader library (dotenv, conf, etc.) — the code reads directly from Node's `process.env`. The frontend (Next.js) uses Next's built-in `NEXT_PUBLIC_*` env var convention.

## Key Files

- `phoenix-backend/src/config.ts` — central config loader and schema
- `phoenix-backend/.env.example` — template of required env vars
- `phoenix-frontend/.env.example` — template of frontend-only env vars
- `phoenix-backend/vercel.json` — Vercel serverless rewrite to `/api/server`
- `phoenix-frontend/next.config.mjs` — Next.js build/runtime config

## Backend Configuration Architecture (`src/config.ts`)

1. **Schema-first**: A `z.object` named `EnvSchema` declares every expected env var with types, coercions, defaults, and custom validators:
   - `MONGO_URL` — must match `mongodb://` or `mongodb+srv://`
   - `JWT_SECRET` — minimum 32 characters
   - `JWT_ALGORITHM` — enum of HS256/HS384/HS512, default HS256
   - `JWT_EXPIRE_MINUTES` — coerced positive integer, default 120
   - `CORS_ORIGINS` — JSON string parsed into `corsOriginList: string[]`
   - `TASK_CREDIT_COST`, `WELCOME_CREDITS` — numeric business flags with defaults
   - `APP_VERSION`, `PORT` — app metadata with defaults

2. **Fail-fast startup**: `getSettings()` caches its result in a module-level `cached` variable. On first call it runs `EnvSchema.safeParse(process.env)`; if validation fails it throws an `Error` listing each invalid field path/message. This error is surfaced at process start because `server.ts` calls `getSettings()` before listening.

3. **Typed export**: Consumers import `getSettings()` and receive a `Settings` type derived from the zod schema via `z.infer`, plus the computed `corsOriginList` field.

4. **Consumers across the backend** (all under `src/`):
   - `app.ts` — uses settings for CORS and app bootstrap
   - `lib/security.ts` — reads JWT algorithm/secret/expiry
   - `routes/tasks.ts` — reads `TASK_CREDIT_COST`
   - `routes/workspaces.ts` — reads `WELCOME_CREDITS`
   - `routes/health.ts` — exposes `APP_VERSION` in health response
   - `server.ts` — calls `getSettings()` as the very first step to fail fast

5. **Database connection**: `db.ts` receives the MongoDB URI from settings (`settings.MONGO_URL`) and passes Mongoose options inline (`useNewUrlParser`, `useUnifiedTopology`, `useCreateIndex`, `useFindAndModify`, `autoIndex: false`).

## Frontend Configuration

- `phoenix-frontend/.env.example` documents `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`.
- Next.js exposes any `NEXT_PUBLIC_*` variables at build time to the client bundle via `process.env.NEXT_PUBLIC_BACKEND_URL`.
- `next.config.mjs` enables `reactStrictMode`, disables ESLint during builds, and sets `experimental.appDir: true` (App Router).

## Deployment Config

- `phoenix-backend/vercel.json` rewrites all routes to `/api/server`, which is the Express entrypoint deployed as a Vercel Serverless Function.
- `phoenix-frontend/vercel.json` (exists but not read here) follows the same pattern for the Next.js app.

## Conventions and Constraints

- **All backend configuration goes through `process.env` only** — there is no dotenv file loading, no YAML/TOML config files, no feature-flag service. Secrets and toggles are exclusively environment variables.
- **Every env var has a zod validator with a default where sensible** — missing values either throw at startup or fall back to a documented default (e.g. `JWT_ALGORITHM = "HS256"`, `PORT = 8000`, `APP_VERSION = "dev"`).
- **Startup failure is intentional**: `server.ts` calls `getSettings()` before connecting to DB or starting the HTTP listener so misconfiguration is caught immediately rather than causing obscure runtime errors later.
- **The `.env.example` files are out of sync with the actual schema**: the example lists `MONGO_URI` and `SECRET_KEY`, while the zod schema expects `MONGO_URL` and `JWT_SECRET`. This mismatch would cause startup to fail against the example file.
- **Frontend env vars follow Next.js conventions**: only variables prefixed with `NEXT_PUBLIC_` are baked into the client bundle; secrets should not be placed there.
- **No layered configuration**: there is no precedence between files, CLI args, or remote config stores — a single flat `process.env` object is the source of truth.