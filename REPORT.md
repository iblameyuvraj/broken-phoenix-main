# Project Phoenix — Repair Report

Every fix below was found by comparing the code against the three READMEs (the source of
truth), then verified by running the real thing: `npm ci`, `npm run typecheck`, `npm run build`,
`npm test`, a seeded MongoDB, the running API, and `phoenix-ci/scripts/smoke.sh` against both a
healthy and a broken stack. Where a fix affects the public API, the verification was an actual
HTTP request.

---

## 1. Backend setup and entry point

**`npm ci` refused to install.** `package.json` asked for `express@5.3.0` and
`@vitest/coverage-v8@1.6.1`, while `package-lock.json` had resolved `express@4.22.3` and
`coverage-v8@2.1.9`; `npm ci` fails when the two disagree. The README says **Express 4**, the code
is written for Express 4 (`asyncHandler` exists precisely because Express 4 does not catch rejected
promises) and `@types/express` is 4.x, so Express 4.22.3 is the correct side of the disagreement.
The coverage package must match `vitest@2.1.9`. Fixed both to the locked versions.

**The start script pointed at a door that did not exist.** `main`/`start` used
`dist/src/server.js` but `tsconfig.json` wrote to `build/`, so `npm start` died with
`Cannot find module`. Changed `outDir` to `dist`.

**Node treated CommonJS output as ESM.** `package.json` declared `"type": "module"` while the
compiler emitted CommonJS (`module: "CommonJS"`, extension-less imports). Node parsed the build
output as ESM and crashed on the first `require`. Removed `"type": "module"`; the compiler and the
runtime now speak the same language.

**Everything said Node 16 while the stack needs Node 20.** `.nvmrc` was `16` and both CI workflows
installed Node 16. Set `.nvmrc` to `20`, `engines.node` to `>=20.0.0`, and the workflows to Node 20.

## 2. Configuration and database

**Three names for one setting.** `config.ts` required `MONGO_URL`, `.env.example` shipped
`MONGO_URI`, and the README, tests and CI all use `MONGODB_URI`. Standardised on `MONGODB_URI`.

**`.env` was never loaded.** `dotenv` was a dependency but nothing called it, so the settings file
sat unread. Added `import "dotenv/config"` at the top of `config.ts`.

**`CORS_ORIGINS` was `JSON.parse`d.** The documentation describes a plain origin (later a
comma-separated list), so startup threw on a perfectly valid value. Replaced with a comma split and
trim.

**Mongoose 8 with Mongoose 4 options.** `connectDb()` passed `useNewUrlParser`, `useUnifiedTopology`,
`useCreateIndex` and `useFindAndModify`, all removed years ago. Removed them.

**Queries ran on a connection nobody had opened.** `mongoose.createConnection()` opens a *separate*
connection, while every model is registered on the default one, so the models were never connected.
Switched to an idempotent `mongoose.connect()` and made it safe to call per serverless invocation.

**The uniqueness promise was never kept.** `autoIndex` was disabled, so the unique index on
`WorkspaceMember(workspace,user)` was never created and two invites could create duplicates.
Indexes are now built on connect (`model.init()`); verified with `db.workspacemembers.indexes()`.

**A model was born twice.** `models/index.ts` registered `User` a second time on a cloned schema,
which throws `OverwriteModelError`. There is now exactly one `User` registration.

**Schema, code and screen disagreed about a user.** The schema had `password`, while register,
login and the seed all used `passwordHash`, so registration failed validation. The schema now uses
`passwordHash` (and the seed, in turn, the same).

**…about a status.** The task enum is `todo | in_progress | done`, but the seed, the frontend types
and the status filter used `doing`, so the seed failed validation and filters matched nothing.
Standardised on `in_progress`.

**…about a number.** `Workspace.credits` was a `String` while the API, the UI and `$inc` treated it
as a number: the balance was returned as `"3"` and arithmetic silently broke. It is a `Number`
now, with `min: 0`.

**A reference to a model that did not exist.** `WorkspaceMember.user` referenced `"user"` (lowercase);
`populate()` returned `null`, and the members endpoint crashed reading `m.user._id`. References
`"User"`.

## 3. HTTP layer

**Body parsing happened after the routes.** `express.json()` was mounted last, so `req.body` was
always `undefined` and every POST answered 422. Moved it before the routers.

**The wildcard had the wrong shape.** `app.all("*", notFound)` is invalid in Express 5's
path-to-regexp; `app.use(notFound)` works on both majors and is what a catch-all should be.

**Tokens were signed with one pen and checked with another.** Signing used `JWT_ALGORITHM`
(default HS256) while verification hard-coded `HS512`, so every freshly issued token was rejected.
Verification now uses the configured algorithm.

**The health check lied.** It returned `200 {"db":"ok"}` without ever touching MongoDB. It now pings
the database and answers `503` with `db:"down"` when the database is unreachable, so a smoke test or
a load balancer can notice.

**A strange request should not kill the process.** The error handler now maps body-parser errors
(413 too large, 400 malformed) and Mongoose validation errors (422) instead of turning them into
500s, and the process logs unhandled rejections/exceptions rather than dying.

## 4. Authorization and multi-tenancy

**Tasks of another tenant were readable.** `GET /api/projects/{id}/tasks` only checked that the
project existed. It now resolves the project through `getProjectForUser`, so non-members get 404.

**The project cache leaked before the lock.** The cached list was returned *before* the membership
check, so a non-member could read another workspace's projects from cache. Authorisation now happens
first.

**Adding a member required nothing.** The route used `requireMember`, so any member could invite
people. It uses `requireAdmin` (owner/admin) as documented.

**Top-ups were available to members.** Credits are money; the route now requires the owner
(`requireOwner`).

**Top-ups could also be booked against a workspace that was not there.** `findByIdAndUpdate` returning
`null` still wrote a ledger row and answered `balance: 0`. It is a 404 now, before the ledger entry.

## 5. Money, idempotency and data correctness

**Two people could spend the last coin.** The handler read the balance, compared it with `< 0`, and
wrote a new value — a classic check-then-act race. It now performs one conditional
`findOneAndUpdate({ credits: { $gte: cost } }, { $inc: { credits: -cost } })`; if no document
matches, it answers 402. Under six concurrent requests on a three-credit workspace, exactly three
succeeded and three got 402, and the balance ended at 0.

**Asking twice cost twice.** The handler looked for the header `idempotency_key`, but the documented
header is `Idempotency-Key`. A replay now returns 200 with the original task, and a genuine
duplicate-key race (two simultaneous identical requests) is resolved to the winner's task, with the
loser's task and charge rolled back.

**A rejected assignee still created a task and charged a credit.** The assignee check ran *after*
`Task.create()`. It now runs before the credit is spent, and any failure after spending refunds the
charge, so the ledger always matches the balance.

**User input was compiled as a regular expression.** `q=.*` matched every task and a crafted pattern
could burn CPU (ReDoS). Input is escaped with `escapeRegex` before building the RegExp.

**Page one was page two, and ties were unstable.** Pagination used `page * page_size` instead of
`(page - 1) * page_size`, so page 1 skipped the first page. Sorting only by `createdAt` made the
order of the 25 seeded tasks (all sharing one timestamp) arbitrary across requests. It now sorts by
`{ createdAt: -1, _id: -1 }`, which keeps pages stable and non-overlapping.

**The cache forgot the wrong key.** The list was stored under `projects:<id>` but invalidated under
`projects:<id>:list`, so a new project never appeared. Both sides now use `projectListKey()`.

**A seed that lied.** `process.exit(0)` ran on the next line after calling the async seed, so it
printed `seed: done` and exited before writing anything; errors were swallowed by `.catch(console.error)`.
It also inserted `"doing"`, which violates the status enum. The seed now runs to completion, exits
1 on failure, and uses valid statuses.

## 6. Vercel

**A function is not a server.** `api/index.ts` called `app.listen()` inside a serverless handler and
did not await the database connection. It now awaits a cached connection and hands the request to
Express, with the app built once per warm lambda.

**The rewrite pointed at a missing function.** `vercel.json` sent every request to `/api/server`,
but the only serverless function in the repository is `api/index.ts`. Destination is now `/api/index`.

## 7. Frontend setup and build

**Packages that refused to sit together.** `react-dom@17.0.2` next to `react@18.3.1`, and
`date-fns` was missing from the lockfile entirely. Aligned `react-dom` to 18.3.1 and regenerated
the lock; `npm ci` now succeeds.

**`next.config.mjs` used `module.exports`.** In an `.mjs` file that is a syntax error. It now uses
`export default`, and the deprecated `experimental.appDir` and the `eslint.ignoreDuringBuilds`
escape hatch are gone.

**A TypeScript option that no longer exists.** `preserveValueImports` was removed in TypeScript 5.6
and made `tsc` error out. Removed.

**`date-fns` changed its doors.** `import format from "date-fns/format"` only worked in v2; v3 has
no such entry point. Now `import { format } from "date-fns"`.

**The build crashed on `localStorage`.** `api.ts` read `localStorage` at module scope, which runs on
the server during prerender ("The server has no window"). Access is now lazy and guarded by
`typeof window`.

**Tokens were written under one name and read under another.** `setToken` wrote `phoenix_token`
while the module read `phoenix.token`, so the session never survived a refresh. One key is used.

**The env variable had two names.** The README documents `NEXT_PUBLIC_API_URL`; the code and
`.env.example` used `NEXT_PUBLIC_BACKEND_URL`. Renamed everywhere.

**Wrong router for the App Router.** The login page imported `useRouter` from `next/router`. It now
imports from `next/navigation`.

**The types described a different API.** `token`, `createdAt`, `createdById`, `assigneeId` and
`"doing"` versus the API's `access_token`, `created_at`, `created_by_id`, `assignee_id` and
`in_progress` — the task table rendered "Invalid Date". Types now mirror the API.

**Vercel was told to run a script nobody wrote.** `buildCommand: "npm run export"` (no such script)
and `installCommand: "npm install --force"`. Removed; the Next.js preset builds normally.

## 8. Frontend behaviour

**Late answers to old questions.** Every response overwrote the previous one, so a slow request for
an old search term could replace the newest results. Each load now uses an `AbortController`; the
previous request is cancelled when the query, filter or page changes, and filter changes reset to
page 1.

**Every failure looked like "nothing found".** The catch block replaced the table with an empty
list. Errors are now shown as errors, and "No tasks match." only appears for a genuinely empty,
successful response.

**An expired session that never actually ended.** The auth provider listened for a
`phoenix:logout` window event that nothing ever dispatched, so a 401 in the middle of a session left
a dead token in `localStorage` and a logged-in-looking shell on screen. `api()` now clears the token
(which also clears the GET cache) and dispatches the event, so `RequireAuth` returns the user to the
login page. Login and register are excluded from that rule, because a 401 there is an answer rather
than an expired session — and the login form now shows the API's "Invalid email or password" instead
of "Your session has expired".

**Fast fingers created two tasks.** `setBusy(true)` happened *after* the `await`, so a second click
got through. The guard is now set before the request, and each submission carries one
`Idempotency-Key`, so even a retry cannot charge twice.

**One user could see another user's data.** The GET cache ignored the token and was never cleared.
Keys now include the token, and the cache is cleared on login, logout and after every write.

**A locked door in the UI.** The members page showed the invite form to plain members (the server
would reject them). It is now only rendered for owners/admins.

## 9. CI/CD pipeline

**The workflow file was rejected.** `backend` declared `env:` twice, and `deploy` had an unclosed
`if: ${{ ... }`. YAML duplicate keys and syntax errors make GitHub refuse the whole file. Rewritten
and validated with a YAML parser plus a duplicate-key check.

**It only listened to a branch nobody pushes to.** `on.push.branches: [master]` never fires, because
the project's branch is `main` — but gating the *whole* workflow to `main` would equally silence CI on
every feature branch and pull request. The workflow now triggers on every push and every pull request,
and only `deploy` is gated, with `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.

**A pipeline that cannot fail.** `npm test || true`, `continue-on-error: true`, `--legacy-peer-deps`,
`actions/checkout@master`, `actions/setup-node@main` and `permissions: write-all`. All replaced with
`npm ci`, real steps, pinned action majors (`@v4`) and `permissions: contents: read`.

**The database lived somewhere else than the address said.** The URI pointed at `mongo:27017`, but
no service container was defined (and the `e2e` job had no database at all). Both jobs now declare a
`mongo:7` service with a published port and connect to `mongodb://localhost:27017/...`, with a
health check.

**Directories that did not exist.** `working-directory: backend` / `frontend` → the real checkout
paths (`phoenix-backend`, `phoenix-frontend`), and the app repos are checked out explicitly.

**Starting a server and waiting for it to finish.** The e2e job ran `npm start` in the foreground,
which blocks until the timeout. Both apps now start in the background with logs, and
`scripts/wait-for.sh` waits for health before the smoke test.

**Jobs that did not wait for each other.** `e2e` now needs `[backend, frontend]`, `deploy` needs
`e2e` and only runs on a push to `main`, and the missing `verify` job runs the smoke test against
production and checks the live version equals `github.sha`.

**A secret said out loud.** The deploy step echoed `${{ secrets.VERCEL_TOKEN }}` into the log.
Removed — the Vercel CLI reads `VERCEL_TOKEN` from the environment — and the CLI is pinned
(`vercel@39.1.0`) instead of floating. The commit and the production URLs also reach commands through
`env:`, never interpolated straight into a `run:` line, and the log-upload step no longer carries
`if-no-files-found: ignore`, which is a step that can hide a failure.

**A smoke detector without a battery.** `smoke.sh` used plain `curl` (which succeeds on 404/500),
called `/health` instead of `/api/health`, printed "SMOKE OK" unconditionally and had no
`set -e`. Rewritten with `set -euo pipefail`, `curl -f`, real assertions (health + db + version,
frontend, login, authenticated calls) and an optional expected commit. Verified: it prints
`SMOKE OK` on the running stack, and exits 1 for a wrong version, a dead frontend and a dead
backend. `scripts/wait-for.sh` (referenced by the README but missing) was added, as was
`.github/dependabot.yml`.

**The app-level workflows had the same problems** (Node 16, `@master`, `|| true`,
`continue-on-error`, no typecheck/build/test). Both were rewritten to install with `npm ci`, then
typecheck, build and (backend) test against a MongoDB service.

---

## Dependency changes and why

| Package | From → To | Reason |
|---|---|---|
| `express` | 5.3.0 → 4.22.3 | The README specifies Express 4, the code is written for it (`asyncHandler`, `@types/express@4`), and the lockfile already resolved 4.22.3, so `npm ci` failed. |
| `@vitest/coverage-v8` | 1.6.1 → 2.1.9 | Must match `vitest@2.1.9`; the mismatched pair is what the lockfile already expected. |
| `react-dom` | 17.0.2 → 18.3.1 | Peer-incompatible with `react@18.3.1`; the lockfile and Next 14 both require React 18. |
| `date-fns` | present in `package.json`, absent from the lock | Lockfile regenerated so `npm ci` is reproducible; the library stays at its declared 3.6.0. |

No packages were added or removed; every other version is unchanged.

## What was verified, and what was not

Verified locally against MongoDB 7 and Node 22: `npm ci`, `npm run typecheck`, `npm run build` and
`npm test` (5/5) in `phoenix-backend`; `npm ci`, `npm run typecheck`, `npm run build` in
`phoenix-frontend`; `npm run seed` and `npm run seed:reset`; `/api/health` truthfulness; pagination,
stable ordering, escaped search, status filtering; idempotent task creation (201 then 200, one
credit); concurrent spending (3 credits, 3 × 201, 3 × 402, balance 0); ledger sum == balance for every
workspace; unique indexes present; role checks (403) and cross-tenant isolation (404); CORS for a
comma-separated origin list; registration, login and duplicate-email 409; malformed JSON 400;
unknown ids 404; and `smoke.sh` passing and failing as intended. All YAML was parsed and checked for
duplicate keys.

Not verified: the interactive browser walk-through of the UI (build and types are green, and every
call the pages make was exercised at the API level) and a live Vercel deployment.
