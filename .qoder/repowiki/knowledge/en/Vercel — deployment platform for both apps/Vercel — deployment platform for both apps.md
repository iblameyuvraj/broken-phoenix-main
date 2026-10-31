---
kind: external_dependency
name: Vercel — deployment platform for both apps
slug: vercel
category: external_dependency
category_hints:
    - vendor_identity
    - framework_behavior
scope:
    - '**'
---

### Vercel
- Both `phoenix-backend` and `phoenix-frontend` are configured for deployment here (`vercel.json` in each app).
- Backend uses framework preset **Other** with every request routed to `api/index.ts` (serverless function); frontend uses the Next.js preset.
- Environment variables (`MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS` for backend; `NEXT_PUBLIC_API_URL` for frontend) are set per-project in Vercel Settings.
- Frontend's `NEXT_PUBLIC_*` variables are baked into the browser bundle at build time, so changing them requires a redeploy of the frontend.