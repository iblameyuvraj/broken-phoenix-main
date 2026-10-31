Three Next.js App Router route segments under `src/app/workspaces/`:
- `page.tsx` renders the workspace index (list + create) via `/api/workspaces`.
- `[id]/page.tsx` renders a single workspace detail: fetches workspace metadata, project list, and credit balance in parallel, exposes an owner-only TopUp form posting to `/api/workspaces/{id}/credits/topup`, and links into `/workspaces/{id}/members`.
- `[id]/members/page.tsx` manages workspace membership by POSTing to `/api/workspaces/{id}/members` with email and role.

Every page is a React Client Component (`"use client"`) wrapped in `<RequireAuth>` from `@/components/RequireAuth`. Data access goes exclusively through the shared `api<T>()` helper from `@/lib/api` (with `describeError` for user-facing messages), and all TypeScript shapes come from `@/lib/types` (`Workspace`, `Project`, `Member`, `Role`). The module has no server-side logic — it is purely a presentation layer over REST endpoints.