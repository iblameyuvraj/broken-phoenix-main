# System Architecture

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [phoenix-backend/package.json](file://phoenix-backend/package.json)
- [phoenix-frontend/package.json](file://phoenix-frontend/package.json)
- [phoenix-ci/README.md](file://phoenix-ci/README.md)
- [phoenix-backend/src/app.ts](file://phoenix-backend/src/app.ts)
- [phoenix-backend/src/server.ts](file://phoenix-backend/src/server.ts)
- [phoenix-backend/src/config.ts](file://phoenix-backend/src/config.ts)
- [phoenix-backend/src/db.ts](file://phoenix-backend/src/db.ts)
- [phoenix-backend/src/lib/auth.ts](file://phoenix-backend/src/lib/auth.ts)
- [phoenix-backend/src/routes/auth.ts](file://phoenix-backend/src/routes/auth.ts)
- [phoenix-backend/src/models/user.ts](file://phoenix-backend/src/models/user.ts)
- [phoenix-backend/src/models/workspace.ts](file://phoenix-backend/src/models/workspace.ts)
- [phoenix-backend/src/models/project.ts](file://phoenix-backend/src/models/project.ts)
- [phoenix-backend/src/models/task.ts](file://phoenix-backend/src/models/task.ts)
- [phoenix-backend/src/models/ledger.ts](file://phoenix-backend/src/models/ledger.ts)
- [phoenix-frontend/src/lib/api.ts](file://phoenix-frontend/src/lib/api.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
Project Phoenix is a multi-tenant project tracker composed of three repositories:
- phoenix-backend: Express.js API with TypeScript, MongoDB (Mongoose), and serverless deployment on Vercel.
- phoenix-frontend: Next.js 14 React application with TypeScript, deployed to Vercel.
- phoenix-ci: GitHub Actions pipeline orchestrating tests, smoke checks, and deployments.

The system uses JWT for authentication, Zod for configuration validation, and MongoDB Atlas as the database. The frontend communicates with the backend via REST APIs, carrying bearer tokens for authenticated requests.

## Project Structure
The repository contains three top-level packages:
- phoenix-backend: API server, models, routes, middleware, configuration, and database initialization.
- phoenix-frontend: Next.js app pages, components, and an API client library.
- phoenix-ci: CI/CD workflow definitions and smoke test scripts.

```mermaid
graph TB
subgraph "Phoenix Backend"
BE_App["Express App<br/>src/app.ts"]
BE_Server["Server Entry<br/>src/server.ts"]
BE_Config["Config & Settings<br/>src/config.ts"]
BE_DB["DB Connection<br/>src/db.ts"]
BE_Routes["Routes<br/>routes/*"]
BE_Models["Models<br/>models/*"]
end
subgraph "Phoenix Frontend"
FE_Next["Next.js App"]
FE_API["API Client<br/>src/lib/api.ts"]
end
subgraph "CI/CD"
GH_Actions["GitHub Actions<br/>pipeline.yml"]
Smoke["Smoke Script<br/>scripts/smoke.sh"]
end
FE_Next --> FE_API
FE_API --> BE_App
BE_Server --> BE_App
BE_App --> BE_Routes
BE_Routes --> BE_Models
BE_App --> BE_Config
BE_Server --> BE_DB
GH_Actions --> FE_Next
GH_Aactions --> BE_App
Smoke --> FE_Next
Smoke --> BE_App
```

**Diagram sources**
- [phoenix-backend/src/app.ts:11-28](file://phoenix-backend/src/app.ts#L11-L28)
- [phoenix-backend/src/server.ts:5-10](file://phoenix-backend/src/server.ts#L5-L10)
- [phoenix-backend/src/config.ts:1-32](file://phoenix-backend/src/config.ts#L1-L32)
- [phoenix-backend/src/db.ts:12-22](file://phoenix-backend/src/db.ts#L12-L22)
- [phoenix-frontend/src/lib/api.ts:3-72](file://phoenix-frontend/src/lib/api.ts#L3-L72)
- [phoenix-ci/README.md:15-27](file://phoenix-ci/README.md#L15-L27)

**Section sources**
- [README.md:7-14](file://README.md#L7-L14)
- [phoenix-backend/package.json:1-42](file://phoenix-backend/package.json#L1-L42)
- [phoenix-frontend/package.json:1-27](file://phoenix-frontend/package.json#L1-L27)
- [phoenix-ci/README.md:1-39](file://phoenix-ci/README.md#L1-L39)

## Core Components
- Backend entrypoint initializes settings, connects to MongoDB, creates the Express app, registers routers, and listens on a port.
- Configuration is validated at startup using Zod; invalid environment variables cause a hard failure.
- Database connection initializes Mongoose and pre-registers all models.
- Authentication middleware validates bearer tokens, resolves users, and enforces workspace membership and admin roles.
- Routes expose endpoints for health, authentication, workspaces, projects, and tasks.
- Models define schemas for User, Workspace, WorkspaceMember, Project, Task, and CreditLedger.
- Frontend API client manages token storage, request headers, error mapping, and optional GET caching.

Key responsibilities:
- Server lifecycle and graceful shutdown are handled in the server entrypoint.
- CORS is configured from settings, allowing credentials.
- Input validation and serialization utilities support consistent request/response shapes.
- Credit operations use an append-only ledger with idempotency keys.

**Section sources**
- [phoenix-backend/src/server.ts:5-23](file://phoenix-backend/src/server.ts#L5-L23)
- [phoenix-backend/src/app.ts:11-28](file://phoenix-backend/src/app.ts#L11-L28)
- [phoenix-backend/src/config.ts:1-32](file://phoenix-backend/src/config.ts#L1-L32)
- [phoenix-backend/src/db.ts:12-22](file://phoenix-backend/src/db.ts#L12-L22)
- [phoenix-backend/src/lib/auth.ts:8-49](file://phoenix-backend/src/lib/auth.ts#L8-L49)
- [phoenix-backend/src/routes/auth.ts:11-51](file://phoenix-backend/src/routes/auth.ts#L11-L51)
- [phoenix-backend/src/models/user.ts:1-14](file://phoenix-backend/src/models/user.ts#L1-L14)
- [phoenix-backend/src/models/workspace.ts:1-22](file://phoenix-backend/src/models/workspace.ts#L1-L22)
- [phoenix-backend/src/models/project.ts:1-12](file://phoenix-backend/src/models/project.ts#L1-L12)
- [phoenix-backend/src/models/task.ts:1-15](file://phoenix-backend/src/models/task.ts#L1-L15)
- [phoenix-backend/src/models/ledger.ts:1-19](file://phoenix-backend/src/models/ledger.ts#L1-L19)
- [phoenix-frontend/src/lib/api.ts:3-85](file://phoenix-frontend/src/lib/api.ts#L3-L85)

## Architecture Overview
The system follows a standard web architecture:
- Browser-based Next.js frontend calls the Express API over HTTPS.
- The API authenticates requests using JWT bearer tokens and enforces authorization based on workspace membership and roles.
- Data is persisted in MongoDB Atlas through Mongoose models.
- CI/CD runs tests, seeds data, performs smoke tests against running services, and deploys both apps to Vercel.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant NextJS as "Next.js Frontend"
participant API as "Express API"
participant Auth as "Auth Middleware"
participant DB as "MongoDB Atlas"
Browser->>NextJS : Load app
NextJS->>API : POST /api/auth/login {email,password}
API->>Auth : Validate token (none)
Auth-->>API : Proceed
API->>DB : Find user by email
DB-->>API : User record
API-->>NextJS : {access_token, user}
NextJS->>NextJS : Store token locally
NextJS->>API : GET /api/workspaces (Authorization : Bearer <token>)
API->>Auth : Decode and validate token
Auth-->>API : Current user resolved
API->>DB : Query workspaces
DB-->>API : Workspaces list
API-->>NextJS : Workspaces JSON
```

**Diagram sources**
- [phoenix-frontend/src/lib/api.ts:33-72](file://phoenix-frontend/src/lib/api.ts#L33-L72)
- [phoenix-backend/src/routes/auth.ts:33-51](file://phoenix-backend/src/routes/auth.ts#L33-L51)
- [phoenix-backend/src/lib/auth.ts:8-27](file://phoenix-backend/src/lib/auth.ts#L8-L27)
- [phoenix-backend/src/db.ts:12-22](file://phoenix-backend/src/db.ts#L12-L22)

## Detailed Component Analysis

### Backend Application Lifecycle
The server bootstraps configuration, connects to MongoDB, creates the Express app, mounts routers, and starts listening. Graceful shutdown handles SIGTERM/SIGINT and disconnects the database.

```mermaid
flowchart TD
Start(["Process start"]) --> LoadSettings["Load and validate settings"]
LoadSettings --> ConnectDB["Connect to MongoDB"]
ConnectDB --> CreateApp["Create Express app"]
CreateApp --> MountRouters["Mount routers"]
MountRouters --> Listen["Listen on port"]
Listen --> Ready(["Ready"])
Ready --> Signal{"Signal received?"}
Signal --> |SIGTERM/SIGINT| Shutdown["Close server and disconnect DB"]
Shutdown --> Exit(["Exit process"])
```

**Diagram sources**
- [phoenix-backend/src/server.ts:5-18](file://phoenix-backend/src/server.ts#L5-L18)
- [phoenix-backend/src/app.ts:11-28](file://phoenix-backend/src/app.ts#L11-L28)
- [phoenix-backend/src/config.ts:19-31](file://phoenix-backend/src/config.ts#L19-L31)
- [phoenix-backend/src/db.ts:12-22](file://phoenix-backend/src/db.ts#L12-L22)

**Section sources**
- [phoenix-backend/src/server.ts:5-23](file://phoenix-backend/src/server.ts#L5-L23)
- [phoenix-backend/src/app.ts:11-28](file://phoenix-backend/src/app.ts#L11-L28)

### Authentication Flow
Authentication uses JWT bearer tokens. Login and register endpoints create tokens; protected routes require valid tokens and resolve the current user.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant AuthRoute as "Auth Route"
participant Security as "Security Utils"
participant DB as "MongoDB"
FE->>AuthRoute : POST /api/auth/register {full_name,email,password}
AuthRoute->>DB : Create user
DB-->>AuthRoute : New user
AuthRoute->>Security : Hash password, create access token
Security-->>AuthRoute : Token
AuthRoute-->>FE : {access_token, user}
FE->>AuthRoute : POST /api/auth/login {email,password}
AuthRoute->>DB : Find user
DB-->>AuthRoute : User
AuthRoute->>Security : Verify password, create token
Security-->>AuthRoute : Token
AuthRoute-->>FE : {access_token, user}
```

**Diagram sources**
- [phoenix-backend/src/routes/auth.ts:11-51](file://phoenix-backend/src/routes/auth.ts#L11-L51)
- [phoenix-backend/src/lib/auth.ts:8-27](file://phoenix-backend/src/lib/auth.ts#L8-L27)

**Section sources**
- [phoenix-backend/src/routes/auth.ts:11-51](file://phoenix-backend/src/routes/auth.ts#L11-L51)
- [phoenix-backend/src/lib/auth.ts:8-27](file://phoenix-backend/src/lib/auth.ts#L8-L27)

### Authorization and Workspace Membership
Protected routes enforce that the requester is a member or admin of the target workspace. Non-members receive a 404 to avoid leaking existence information.

```mermaid
flowchart TD
Req["Incoming Request"] --> CheckToken["Validate Bearer Token"]
CheckToken --> ResolveUser["Resolve User"]
ResolveUser --> CheckMember{"Is user member of workspace?"}
CheckMember --> |No| NotFound["Return 404 Not Found"]
CheckMember --> |Yes| CheckRole{"Is role owner/admin?"}
CheckRole --> |No| Forbidden["Return 403 Forbidden"]
CheckRole --> |Yes| Allow["Proceed to handler"]
```

**Diagram sources**
- [phoenix-backend/src/lib/auth.ts:29-42](file://phoenix-backend/src/lib/auth.ts#L29-L42)

**Section sources**
- [phoenix-backend/src/lib/auth.ts:29-42](file://phoenix-backend/src/lib/auth.ts#L29-L42)

### Data Model Relationships
The domain model includes users, workspaces, members, projects, tasks, and an append-only credit ledger.

```mermaid
erDiagram
USER {
string email
string fullName
string password
}
WORKSPACE {
string name
ObjectId owner
string credits
}
WORKSPACE_MEMBER {
ObjectId workspace
ObjectId user
enum role
}
PROJECT {
ObjectId workspace
string name
string description
}
TASK {
ObjectId project
string title
enum status
ObjectId createdBy
ObjectId assignee
date createdAt
}
CREDIT_LEDGER {
ObjectId workspace
number delta
string reason
ObjectId task
string idempotencyKey
}
USER ||--o{ WORKSPACE : "owns"
USER ||--o{ WORKSPACE_MEMBER : "member"
WORKSPACE ||--o{ WORKSPACE_MEMBER : "has members"
WORKSPACE ||--o{ PROJECT : "contains"
PROJECT ||--o{ TASK : "contains"
WORKSPACE ||--o{ CREDIT_LEDGER : "credits"
TASK ||--o{ CREDIT_LEDGER : "reason reference"
```

**Diagram sources**
- [phoenix-backend/src/models/user.ts:1-14](file://phoenix-backend/src/models/user.ts#L1-L14)
- [phoenix-backend/src/models/workspace.ts:1-22](file://phoenix-backend/src/models/workspace.ts#L1-L22)
- [phoenix-backend/src/models/project.ts:1-12](file://phoenix-backend/src/models/project.ts#L1-L12)
- [phoenix-backend/src/models/task.ts:1-15](file://phoenix-backend/src/models/task.ts#L1-L15)
- [phoenix-backend/src/models/ledger.ts:1-19](file://phoenix-backend/src/models/ledger.ts#L1-L19)

**Section sources**
- [phoenix-backend/src/models/user.ts:1-14](file://phoenix-backend/src/models/user.ts#L1-L14)
- [phoenix-backend/src/models/workspace.ts:1-22](file://phoenix-backend/src/models/workspace.ts#L1-L22)
- [phoenix-backend/src/models/project.ts:1-12](file://phoenix-backend/src/models/project.ts#L1-L12)
- [phoenix-backend/src/models/task.ts:1-15](file://phoenix-backend/src/models/task.ts#L1-L15)
- [phoenix-backend/src/models/ledger.ts:1-19](file://phoenix-backend/src/models/ledger.ts#L1-L19)

### Frontend API Client
The frontend API client centralizes fetch calls, attaches bearer tokens, maps HTTP errors to user-friendly messages, and optionally caches GET responses.

```mermaid
flowchart TD
Call["api(path, options)"] --> CheckCache{"GET and cache enabled?"}
CheckCache --> |Yes| GetCached["Check local cache"]
GetCached --> CacheHit{"Cache hit?"}
CacheHit --> |Yes| ReturnCache["Return cached data"]
CacheHit --> |No| Fetch["Perform fetch"]
CheckCache --> |No| Fetch
Fetch --> ResponseOK{"Response ok?"}
ResponseOK --> |No| MapError["Map to ApiError"]
ResponseOK --> |Yes| ParseJSON["Parse JSON"]
ParseJSON --> MaybeCache{"GET and cache enabled?"}
MaybeCache --> |Yes| SetCache["Set cache"]
MaybeCache --> |No| ReturnData["Return data"]
SetCache --> ReturnData
MapError --> ThrowError["Throw ApiError"]
```

**Diagram sources**
- [phoenix-frontend/src/lib/api.ts:33-85](file://phoenix-frontend/src/lib/api.ts#L33-L85)

**Section sources**
- [phoenix-frontend/src/lib/api.ts:3-85](file://phoenix-frontend/src/lib/api.ts#L3-L85)

### CI/CD Pipeline Topology
The pipeline defines jobs for backend and frontend checks, an end-to-end job with real MongoDB and smoke testing, deployment to Vercel on main branch pushes, and production verification.

```mermaid
graph TB
GH["GitHub"] --> WF["Workflow: pipeline.yml"]
WF --> JobBackend["Job: backend"]
WF --> JobFrontend["Job: frontend"]
JobBackend --> E2E["Job: e2e"]
JobFrontend --> E2E
E2E --> Deploy["Job: deploy (main only)"]
Deploy --> Verify["Job: verify"]
E2E --> Smoke["Run smoke.sh"]
Verify --> SmokeProd["Run smoke.sh against prod"]
```

**Diagram sources**
- [phoenix-ci/README.md:15-27](file://phoenix-ci/README.md#L15-L27)

**Section sources**
- [phoenix-ci/README.md:15-39](file://phoenix-ci/README.md#L15-L39)

## Dependency Analysis
- Backend depends on Express, Mongoose, JSON Web Tokens, Zod, and CORS.
- Frontend depends on Next.js, React, and date-fns.
- CI/CD depends on GitHub Actions and external services (MongoDB Atlas, Vercel).

```mermaid
graph LR
FE["phoenix-frontend"] --> API["phoenix-backend"]
API --> DB["MongoDB Atlas"]
GH["GitHub Actions"] --> FE
GH --> API
```

**Diagram sources**
- [phoenix-backend/package.json:20-26](file://phoenix-backend/package.json#L20-L26)
- [phoenix-frontend/package.json:14-18](file://phoenix-frontend/package.json#L14-L18)
- [phoenix-ci/README.md:15-27](file://phoenix-ci/README.md#L15-L27)

**Section sources**
- [phoenix-backend/package.json:1-42](file://phoenix-backend/package.json#L1-L42)
- [phoenix-frontend/package.json:1-27](file://phoenix-frontend/package.json#L1-L27)
- [phoenix-ci/README.md:15-39](file://phoenix-ci/README.md#L15-L39)

## Performance Considerations
- Use serverless deployment for the backend to scale automatically and reduce operational overhead.
- Keep request bodies small and validated early to minimize processing time.
- Leverage MongoDB indexes defined in models for efficient queries.
- Avoid unnecessary re-fetches by using the frontend’s GET cache where appropriate.
- Ensure CORS origins are narrowly scoped to reduce overhead and improve security.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and patterns:
- Invalid environment configuration causes startup failure due to strict Zod validation.
- Health endpoint must reflect actual service state; ensure it checks connectivity.
- Authentication failures occur when tokens are missing, malformed, or expired.
- Authorization returns 404 for unknown workspace IDs to prevent enumeration.
- Duplicate key errors during registration should map to 409 Conflict.
- Frontend error mapping translates HTTP statuses into user-friendly messages.

Operational tips:
- Verify MongoDB connection URI format and network access rules.
- Confirm CORS origin list matches the frontend URL.
- Ensure secrets are not printed in logs or pipelines.
- Run smoke tests locally against running services to validate integration.

**Section sources**
- [phoenix-backend/src/config.ts:19-31](file://phoenix-backend/src/config.ts#L19-L31)
- [phoenix-backend/src/routes/auth.ts:11-51](file://phoenix-backend/src/routes/auth.ts#L11-L51)
- [phoenix-backend/src/lib/auth.ts:8-42](file://phoenix-backend/src/lib/auth.ts#L8-L42)
- [phoenix-frontend/src/lib/api.ts:74-85](file://phoenix-frontend/src/lib/api.ts#L74-L85)
- [phoenix-ci/README.md:29-39](file://phoenix-ci/README.md#L29-L39)

## Conclusion
Project Phoenix combines a secure, typed backend with a modern Next.js frontend and a robust CI/CD pipeline. The design emphasizes clear separation of concerns, strong validation, and safe defaults. With JWT-based authentication, workspace-scoped authorization, and an append-only credit ledger, the system supports multi-tenant workflows while maintaining data integrity. Deployment to Vercel and MongoDB Atlas simplifies operations, and the pipeline ensures quality gates before production releases.

[No sources needed since this section summarizes without analyzing specific files]