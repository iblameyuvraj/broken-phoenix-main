---
kind: error_handling
name: Express Backend Error Handling via HttpError, asyncHandler, and Centralized errorHandler
category: error_handling
scope:
    - '**'
source_files:
    - phoenix-backend/src/lib/http.ts
    - phoenix-backend/src/app.ts
    - phoenix-backend/src/server.ts
    - phoenix-backend/src/lib/auth.ts
---

## Overview

The Phoenix backend (Express + Mongoose) uses a small, centralized error-handling system built around a single custom `HttpError` class. Route handlers throw typed HTTP errors with explicit status codes; Express middleware catches them and translates them into JSON responses.

## Key Files and Packages

- `phoenix-backend/src/lib/http.ts` — defines the `HttpError` class, the `asyncHandler` wrapper, Zod-based body parsing (`parseBody`), ObjectId validation (`parseId`), duplicate-key detection (`isDuplicateKey`), a 404 catch-all (`notFound`), and the global `errorHandler` Express middleware.
- `phoenix-backend/src/app.ts` — wires routes, registers `express.json`, mounts `notFound`, then installs `errorHandler` as the final error middleware.
- `phoenix-backend/src/server.ts` — top-level entry point; unhandled promise rejections from `main()` are caught and logged before `process.exit(1)`.
- `phoenix-backend/src/lib/auth.ts` — authorization helpers that throw `HttpError` for 401/403/404 cases.
- `phoenix-backend/src/routes/*.ts` — route handlers that throw `HttpError` for domain-specific failures (e.g. missing project/workspace, insufficient credits, duplicate registration).

## Architecture and Conventions

### Custom `HttpError` type

```typescript
class HttpError extends Error {
  constructor(public status: number, public detail: unknown)
}
```

Every application-level failure is represented by an `HttpError(status, detail)`. The `detail` field can be a string or structured data (e.g. Zod issues array). This is the sole sentinel-error type used across routes and auth helpers.

### Promise rejection bridging

Express 4 does not automatically catch rejected promises in async route handlers. Every async handler is wrapped with `asyncHandler(fn)` which calls `.catch(next)`, funneling rejections into Express's error pipeline:

```typescript
export function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}
```

Auth guards like `requireUser` use this wrapper so thrown `HttpError`s propagate correctly.

### Global error middleware

`app.ts` installs `errorHandler` after all routes:

```typescript
app.use(errorHandler);
```

The middleware discriminates on error type and maps each to a specific HTTP response:

| Error type | Status | Response body |
|---|---:|---|
| `HttpError` | `err.status` | `{ detail: err.detail }` |
| `ZodError` | 422 | `{ detail: err.issues }` |
| `mongoose.Error.CastError` | 404 | `{ detail: "Not found" }` |
| `SyntaxError` with `body` property | 400 | `{ detail: "Malformed JSON body" }` |
| Any other error | 500 | `{ detail: "Internal server error" }` (after `console.error(err)`) |

This is the single place where error-to-HTTP mapping happens.

### Validation-driven errors

- Body payloads are validated through `parseBody(schema, body)` which throws `HttpError(422, parsed.error.issues)` on invalid input.
- Path parameters are validated through `parseId(raw, what)` which throws `HttpError(404, "${what} not found")` when the value is not a 24-hex MongoDB ObjectId. The comment documents the design decision: path-id validation should never produce a 500.

### Domain conventions observed in routes

Route handlers consistently throw `HttpError` with semantic status codes rather than generic exceptions:

- Missing resources → 404 (`Project not found`, `Workspace not found`, `No user with that email`).
- Authentication failures → 401 (`Not authenticated`, `Invalid or expired token`, `User no longer exists`).
- Authorization failures → 403 (`Admin role required`).
- Duplicate registration → 409 (`Email already registered`), detected via `isDuplicateKey(err)` checking `code === 11000`.
- Insufficient workspace credits → 402 (`Not enough credits`).
- Invalid assignee → 422 (`Assignee is not a workspace member`).

A notable convention in `lib/auth.ts` is that missing workspace membership returns 404 rather than 403, documented inline: "so we don't leak which workspace ids exist." This intentionally blurs existence vs. permission boundaries to avoid information disclosure.

### Startup and process-level error handling

`server.ts` calls `getSettings()` early to fail fast on bad configuration (which throws `Error` if env vars are missing), connects to MongoDB, then listens. Uncaught rejections from `main()` are caught at the bottom of the file, logged, and terminate the process with exit code 1. Graceful shutdown handlers for `SIGTERM`/`SIGINT` close the HTTP server and disconnect the DB before exiting.

## Conventions and Constraints

- **Application errors are expressed as `HttpError(status, detail)`** — thrown from routes and auth helpers, never plain `Error` objects (except in `config.ts` for startup validation and `security.ts` for malformed tokens).
- **Async route handlers are always wrapped with `asyncHandler`** — this is the mechanism that bridges promise rejections into Express's error pipeline.
- **All error-to-HTTP mapping is centralized in `errorHandler`** — no route handler writes `res.status(...).json(...)` directly for error responses.
- **Validation errors map to 422** — both Zod parse failures and domain validation failures (e.g. invalid assignee) use 422.
- **Missing-resource checks prefer 404 over 403** — applied to workspace membership and project lookup to avoid leaking resource existence.
- **MongoDB cast errors are normalized to 404** — preventing malformed ObjectIds from surfacing as 500s.
- **Unhandled errors fall through to 500** — the default branch logs the error and returns a generic message, ensuring no silent failures.