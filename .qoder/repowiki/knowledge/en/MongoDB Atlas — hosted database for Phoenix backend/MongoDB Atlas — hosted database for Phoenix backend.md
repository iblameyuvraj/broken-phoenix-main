---
kind: external_dependency
name: MongoDB Atlas — hosted database for Phoenix backend
slug: mongodb-atlas
category: external_dependency
category_hints:
    - vendor_identity
    - client_constraint
scope:
    - '**'
---

### MongoDB Atlas
- Hosted MongoDB service used by `phoenix-backend` as its data store; connection string is injected via `MONGODB_URI` in `.env` / Vercel env.
- For local dev, a standalone `mongod` on `mongodb://localhost:27017/phoenix` is also supported.
- The top-level README instructs users to create a free cluster and append `/phoenix` to the driver URI.