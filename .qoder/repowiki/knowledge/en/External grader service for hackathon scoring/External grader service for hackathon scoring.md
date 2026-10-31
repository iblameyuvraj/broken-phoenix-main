---
kind: external_dependency
name: External grader service for hackathon scoring
slug: grader
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

### Grader
- Teams upload their code (zipped without `node_modules`, build output, `.git`, `.env`); it installs, builds, seeds against a fresh MongoDB, and runs hidden tests across Backend, Frontend, App config & CI, and Pipeline (YAML).
- Returns pass/fail counts per section but not which individual tests failed.