---
kind: external_dependency
name: GitHub Actions — CI/CD pipeline runner
slug: github-actions
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

### GitHub Actions
- The `phoenix-ci` repo contains only configuration: `.github/workflows/pipeline.yml` defines the test → smoke → deploy → verify workflow, plus `scripts/smoke.sh` and `scripts/wait-for.sh`.
- Secrets required from GitHub repo settings: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_BACKEND_PROJECT_ID`, `VERCEL_FRONTEND_PROJECT_ID`; variables: `BACKEND_URL`, `FRONTEND_URL`.
- Rules: least-privilege permissions, actions pinned to versions, no step can hide failures, every job has a timeout, caches keyed on lockfile.