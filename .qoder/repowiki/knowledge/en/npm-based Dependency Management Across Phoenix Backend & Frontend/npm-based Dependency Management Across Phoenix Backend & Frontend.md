---
kind: dependency_management
name: npm-based Dependency Management Across Phoenix Backend & Frontend
category: dependency_management
scope:
    - '**'
source_files:
    - phoenix-backend/package.json
    - phoenix-backend/package-lock.json
    - phoenix-frontend/package.json
    - phoenix-frontend/package-lock.json
    - phoenix-backend/.nvmrc
    - phoenix-ci/.github/workflows/pipeline.yml
---

## System / Approach

The repository uses **npm** (Node Package Manager) as its sole package manager for both sub-projects (`phoenix-backend`, `phoenix-frontend`). There is no monorepo tool (no `package.json` workspaces, no pnpm/yarn/bun). Each sub-project maintains its own `package.json` plus a committed `package-lock.json` (lockfileVersion 3), pinning every transitive dependency tree.

There is no vendoring strategy: dependencies are fetched from the public npm registry at install time. No `.npmrc`, no private registries, no `GOPRIVATE`, no proxy configuration was found.

## Key Files

- `phoenix-backend/package.json` — backend runtime + dev dependencies; declares `engines.node >=18.17.0`; `type: module`.
- `phoenix-backend/package-lock.json` — deterministic lockfile for the backend.
- `phoenix-frontend/package.json` — frontend runtime + dev dependencies; declares `engines.node >=18.17.0`.
- `phoenix-frontend/package-lock.json` — deterministic lockfile for the frontend.
- `phoenix-backend/.nvmrc` — pins local developer Node version to `16`.
- `phoenix-ci/.github/workflows/pipeline.yml` — CI installs deps via `npm install --legacy-peer-deps`.

## Architecture and Conventions

- **Per-package manifests**: each of the two apps owns its own dependency graph independently; there is no shared dependency set or workspace hoisting.
- **Exact version pinning in manifests**: both `dependencies` and `devDependencies` use exact semver strings (e.g. `express: "5.3.0"`, `next: "14.2.35"`, `react: "18.3.1"`) rather than ranges. The lockfiles then freeze every transitive dependency with `resolved` URLs against `https://registry.npmjs.org/` and `integrity` sha512 hashes.
- **Lockfiles are committed**: both `package-lock.json` files are tracked in the repo, so `npm ci` can reproduce the exact tree deterministically.
- **Engine constraints**: both packages declare `engines.node >=18.17.0` to constrain the runtime Node version.
- **Dev vs. runtime separation**: test/build tooling (`vitest`, `tsx`, `typescript`, `@types/*`, `supertest`, `@vitest/coverage-v8`) lives exclusively under `devDependencies`; only runtime libraries (`express`, `mongoose`, `cors`, `dotenv`, `jsonwebtoken`, `zod` for backend; `next`, `react`, `react-dom`, `date-fns` for frontend) go under `dependencies`.
- **CI uses legacy peer resolution**: the workflow runs `npm install --legacy-peer-deps` for both backend and frontend jobs, indicating that peer dependency conflicts are expected and deliberately suppressed.
- **NPM cache in CI**: the backend job caches `~/.npm` keyed by `hashFiles('**/package.json')` to speed up repeated installs.

## Observed Inconsistencies (evidence from file contents)

- `phoenix-backend/.nvmrc` pins Node `16`, while both `package.json` files declare `engines.node >=18.17.0` — these conflict.
- `phoenix-backend/package.json` lists `express: "5.3.0"`, but `phoenix-backend/package-lock.json` resolves `express` to `4.22.3` — the manifest and lockfile disagree.
- `phoenix-frontend/package.json` lists `react-dom: "17.0.2"`, but `phoenix-frontend/package-lock.json` resolves it to `18.3.1` — another manifest/lockfile mismatch.
- `phoenix-ci/.github/workflows/pipeline.yml` sets `NODE_VERSION: "16"` and references working directories `backend` / `frontend`, whereas the actual directories are `phoenix-backend` / `phoenix-frontend`. This means the CI cannot locate the apps' `package.json` files.
- The deploy job condition checks `refs/heads/main` while the push trigger is on `master`, so deployment never fires on pushes to `master`.

## Rules Enforced by the Codebase

1. Dependencies are declared in per-app `package.json` files under `dependencies` (runtime) and `devDependencies` (tooling/test); this is enforced by the presence of those sections in both manifests.
2. Transitive trees are frozen by committing `package-lock.json` (lockfileVersion 3) alongside each manifest, making `npm ci` reproducible.
3. Peer dependency conflicts are intentionally ignored during install — CI explicitly passes `--legacy-peer-deps` in every `npm install` invocation.
4. The intended Node runtime is constrained to `>=18.17.0` via the `engines` field in both `package.json` files.
5. Local development Node version is pinned to `16` via `phoenix-backend/.nvmrc` (this is a convention, not enforced by npm itself).
6. No private registry or vendored dependencies are configured — all packages resolve from the public npm registry.