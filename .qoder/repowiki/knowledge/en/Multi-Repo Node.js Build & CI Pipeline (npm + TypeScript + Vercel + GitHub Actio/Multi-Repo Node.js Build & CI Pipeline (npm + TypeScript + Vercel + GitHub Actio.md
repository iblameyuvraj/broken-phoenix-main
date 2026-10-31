---
kind: build_system
name: Multi-Repo Node.js Build & CI Pipeline (npm + TypeScript + Vercel + GitHub Actions)
category: build_system
scope:
    - '**'
source_files:
    - phoenix-backend/package.json
    - phoenix-frontend/package.json
    - phoenix-backend/.github/workflows/ci.yml
    - phoenix-frontend/.github/workflows/ci.yml
    - phoenix-ci/.github/workflows/pipeline.yml
    - phoenix-ci/scripts/smoke.sh
    - phoenix-backend/vercel.json
    - phoenix-frontend/vercel.json
---

# Build System Overview

Project Phoenix is a multi-repo Node.js application composed of three top-level directories: `phoenix-backend` (Express + Mongoose), `phoenix-frontend` (Next.js App Router), and `phoenix-ci` (GitHub Actions pipeline + smoke tests). There is no monorepo tool (no Lerna, pnpm workspace, Turborepo); each subproject manages its own dependencies via `package.json`.

## Build Tools & Conventions

- **Runtime**: Node.js. Both apps declare `engines.node >= 18.17.0` in their `package.json`, but the CI workflows pin `node-version: "16"` — a mismatch between declared engine and CI runtime.
- **Package manager**: npm (`npm install --legacy-peer-deps` is used everywhere; lockfiles are `package-lock.json`).
- **TypeScript compilation**:
  - Backend: `tsc -p tsconfig.json` produces output under `dist/`; entry point is `dist/src/server.js` (declared as `main` in `package.json`). Dev uses `tsx watch src/server.ts` for hot reload.
  - Frontend: Next.js handles compilation via `next build`; typecheck runs separately with `tsc --noEmit`.
- **Testing**: Vitest (`vitest run`) for the backend; no test script exists for the frontend.
- **Seeding**: Backend provides `npm run seed` / `npm run seed:reset` via `tsx scripts/seed.ts`.
- **Deployment target**: Vercel. Each app ships a `vercel.json` that configures the framework and build command.

## Per-App Scripts

### phoenix-backend (`phoenix-backend/package.json`)
| Script | Command | Purpose |
|---|---|---|
| `dev` | `tsx watch src/server.ts` | Hot-reload dev server |
| `build` | `tsc -p tsconfig.json` | Compile TS to `dist/` |
| `start` | `node dist/src/server.js` | Production entry |
| `typecheck` | `tsc -p tsconfig.json --noEmit` | Type-only check |
| `seed` / `seed:reset` | `tsx scripts/seed.ts [--reset]` | Database seeding |
| `test` | `vitest run` | Unit/integration tests |
| `test:coverage` | `vitest run --coverage` | Coverage report |

### phoenix-frontend (`phoenix-frontend/package.json`)
| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev -p 3000` | Local dev server on port 3000 |
| `build` | `next build` | Next.js production build |
| `start` | `next start -p 3000` | Serve built output |
| `typecheck` | `tsc --noEmit` | Type-only check |

## CI Pipelines (GitHub Actions)

Three workflows exist:

1. **`phoenix-backend/.github/workflows/ci.yml`** — Runs on push/PR, installs deps with `--legacy-peer-deps`, then `npm test || true`. Sets `MONGODB_URI=mongodb://localhost:27017/phoenix_test` and `JWT_SECRET=ci-only-secret`.
2. **`phoenix-frontend/.github/workflows/ci.yml`** — Runs on push/PR, installs deps, then `npm run build` with `continue-on-error: true`.
3. **`phoenix-ci/.github/workflows/pipeline.yml`** — Orchestrates the full flow on pushes to `master`:
   - `backend` job: checkout → setup-node@16 → cache `~/.npm` keyed by `hashFiles('**/package.json')` → `npm install --legacy-peer-deps` → `npm test || true`.
   - `frontend` job: checkout → setup-node@16 → `npm install --legacy-peer-deps` → `npm run build` (continue-on-error).
   - `e2e` job: starts both apps locally (`npm start` for backend, `npm run dev &` for frontend), sleeps 10s, then runs `./scripts/smoke.sh http://localhost:8000`.
   - `deploy` job: runs only when `github.ref == 'refs/heads/main'`, installs `vercel` globally, deploys with `vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}`.

Note: The `pipeline.yml` sets `working-directory: backend` / `frontend` for the first two jobs but references paths like `phoenix-backend` / `phoenix-frontend` in the e2e job — these are inconsistent relative to the repo root.

## Smoke Tests

`phoenix-ci/scripts/smoke.sh` performs three HTTP checks against the running services:
1. GET `/health` on the backend (default `http://localhost:8000`).
2. GET `/` on the frontend (default `http://localhost:3000`).
3. POST `/api/auth/login` with hardcoded credentials `{email:"alice@phoenix.dev", password:"phoenix123"}`.

The script exits non-zero if any `curl` call fails, making it a gate for the e2e job.

## Deployment Configuration

- **Backend** (`phoenix-backend/vercel.json`): rewrites all routes to `/api/server`, indicating deployment as a Vercel Serverless Function API.
- **Frontend** (`phoenix-frontend/vercel.json`): declares `framework: nextjs`, `installCommand: npm install --force`, and `buildCommand: npm run export` (static export mode).
- The global deploy step in `pipeline.yml` invokes `vercel deploy --prod` without specifying a project path, relying on Vercel's auto-detection.

## Versioning Strategy

Both apps hardcode `"version": "1.0.0"` in their `package.json` with no dynamic version injection, changelog automation, or release tagging in the CI. Versions are not propagated between repos.

## Observed Constraints & Rules

- Dependency installation always uses `npm install --legacy-peer-deps` across every CI job (enforced by the workflow YAMLs).
- The backend requires MongoDB at `mongodb://localhost:27017/phoenix_test` during tests (set via env in CI).
- The backend requires `JWT_SECRET` to be set (injected as `ci-only-secret` in CI).
- The frontend build is allowed to fail without failing the pipeline (`continue-on-error: true`).
- The backend test suite is also allowed to fail without failing the pipeline (`|| true`).
- E2E smoke tests require both services to be reachable at `http://localhost:8000` (backend) and `http://localhost:3000` (frontend).
- Deployment only triggers from the `main` branch (`if: ${{ github.ref == 'refs/heads/main' }}`), while the rest of the pipeline triggers on `push` to `master` — a branch naming inconsistency.