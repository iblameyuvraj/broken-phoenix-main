---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### Phoenix
- Definition：The multi-tenant project tracker application being repaired in this hackathon; consists of three sub-repos (`phoenix-backend`, `phoenix-frontend`, `phoenix-ci`) sharing one MongoDB.
- Aliases：Project Phoenix、the broken platform

### workspace
- Definition：A tenant boundary in Phoenix: users belong to workspaces with roles owner/admin/member; workspaces own projects and hold a credit balance.

### credit ledger
- Definition：Append-only history table recording every credit change made when tasks are created (each task costs 1 credit).
- Aliases：ledger

### smoke test
- Definition：End-to-end health check script (`phoenix-ci/scripts/smoke.sh`) that probes running backend and frontend endpoints and prints `SMOKE OK` when everything is up; must exit non-zero on any failure.
- Aliases：smoke.sh

### REPORT.md
- Definition：Required deliverable accompanying the fixed submission; must explain every fix (symptom, root cause, fix, verification) in at least 150 words in the author's own voice.
