---
kind: logging_system
name: No Structured Logging System — Bare console.log Usage
category: logging_system
scope:
    - '**'
source_files:
    - phoenix-backend/src/server.ts
    - phoenix-backend/src/lib/http.ts
    - phoenix-backend/scripts/seed.ts
---

## What system/approach is used

The Phoenix repository does **not** implement a structured logging system. There is no dedicated logger library (no `winston`, `pino`, `bunyan`, `log4js`, `morgan`, or similar), no log-level configuration, no log formatter, and no centralized logger initialization. All output goes through Node's built-in `console.log` / `console.error`.

## Key files and locations

- `phoenix-backend/src/server.ts` — startup/shutdown messages and unhandled error reporting via `console.log` and `console.error`.
- `phoenix-backend/src/lib/http.ts` — HTTP request error handling uses `console.error(err)`.
- `phoenix-backend/scripts/seed.ts` — seed script prints informational messages via `console.log`.

There are no files under `log/`, `logging/`, or any other directory that define logging infrastructure. No `package.json` dependency on a logging framework exists in either `phoenix-backend` or `phoenix-frontend`.

## Architecture and conventions

- Output is ad-hoc: each file that needs to emit a message calls `console.log` or `console.error` directly at the call site.
- No log levels are used; there is no distinction between info/debug/warn/error beyond choosing between `console.log` and `console.error`.
- No structured fields (e.g., correlation IDs, user IDs, workspace/project scoping) are attached to log lines.
- No log sinks or transports are configured — all output targets the default Node process stdout/stderr.
- The frontend (`phoenix-frontend`) contains zero `console.*` calls in its source tree, so it produces no application logs of its own.

## Conventions and constraints

Observed convention (descriptive): production-facing messages in the backend use `console.log` for normal flow (server start, shutdown signals) and `console.error` for error paths (HTTP handler errors, uncaught exceptions). This is an informal pattern with no enforcement mechanism — nothing in the codebase validates, filters, or formats these outputs.

No formal rules exist: there is no lint rule, no shared logger module, and no documentation prescribing how logging should be done. Because no logging framework is present, this category has limited applicability — the repo simply lacks a logging system beyond bare `console` usage.