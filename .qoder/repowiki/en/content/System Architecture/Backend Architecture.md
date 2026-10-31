# Backend Architecture

<cite>
**Referenced Files in This Document**
- [README.md](file://phoenix-backend/README.md)
- [package.json](file://phoenix-backend/package.json)
- [vercel.json](file://phoenix-backend/vercel.json)
- [api/index.ts](file://phoenix-backend/api/index.ts)
- [src/app.ts](file://phoenix-backend/src/app.ts)
- [src/server.ts](file://phoenix-backend/src/server.ts)
- [src/config.ts](file://phoenix-backend/src/config.ts)
- [src/db.ts](file://phoenix-backend/src/db.ts)
- [src/lib/http.ts](file://phoenix-backend/src/lib/http.ts)
- [src/lib/auth.ts](file://phoenix-backend/src/lib/auth.ts)
- [src/lib/schemas.ts](file://phoenix-backend/src/lib/schemas.ts)
- [src/lib/cache.ts](file://phoenix-backend/src/lib/cache.ts)
- [src/routes/auth.ts](file://phoenix-backend/src/routes/auth.ts)
- [src/routes/health.ts](file://phoenix-backend/src/routes/health.ts)
- [src/routes/projects.ts](file://phoenix-backend/src/routes/projects.ts)
- [src/routes/tasks.ts](file://phoenix-backend/src/routes/tasks.ts)
- [src/routes/workspaces.ts](file://phoenix-backend/src/routes/workspaces.ts)
</cite>

## Table of Contents
1. Introduction
2. Project Structure
3. Core Components
4. Architecture Overview
5. Detailed Component Analysis
6. Dependency Analysis
7. Performance Considerations
8. Troubleshooting Guide
9. Conclusion

## Introduction
This document describes the Phoenix backend architecture: an Express.js API built with TypeScript, Mongoose, and Zod for validation. It explains the serverless deployment pattern on Vercel, environment configuration, database connection management, middleware pipeline, route organization, and service-layer separation. It also covers performance considerations such as connection reuse, caching strategies, and memory management in serverless environments.

## Project Structure
The backend is organized by feature and layer:
- Entry points:
  - Server process entry point for local development
  - Vercel serverless function handler
- Application bootstrap:
  - Express app creation and middleware wiring
- Configuration:
  - Environment schema validation and settings cache
- Database:
  - Connection lifecycle and model initialization
- Shared libraries:
  - HTTP utilities, authentication helpers, request schemas, in-process cache
- Routes:
  - Health, authentication, workspaces, projects, tasks

```mermaid
graph TB
subgraph "Vercel"
VJson["vercel.json"]
ApiIndex["api/index.ts"]
end
subgraph "Express App"
AppTs["src/app.ts"]
ServerTs["src/server.ts"]
end
subgraph "Configuration & DB"
ConfigTs["src/config.ts"]
DbTs["src/db.ts"]
end
subgraph "Libraries"
HttpTs["src/lib/http.ts"]
AuthTs["src/lib/auth.ts"]
SchemasTs["src/lib/schemas.ts"]
CacheTs["src/lib/cache.ts"]
end
subgraph "Routes"
HealthTs["src/routes/health.ts"]
AuthRouteTs["src/routes/auth.ts"]
WorkspacesTs["src/routes/workspaces.ts"]
ProjectsTs["src/routes/projects.ts"]
TasksTs["src/routes/tasks.ts"]
end
VJson --> ApiIndex
ApiIndex --> AppTs
ServerTs --> AppTs
AppTs --> HealthTs
AppTs --> AuthRouteTs
AppTs --> WorkspacesTs
AppTs --> ProjectsTs
AppTs --> TasksTs
AppTs --> ConfigTs
AppTs --> HttpTs
AuthRouteTs --> AuthTs
WorkspacesTs --> AuthTs
ProjectsTs --> AuthTs
TasksTs --> AuthTs
WorkspacesTs --> CacheTs
ProjectsTs --> CacheTs
AppTs --> DbTs
```

**Diagram sources**
- [vercel.json:1-5](file://phoenix-backend/vercel.json#L1-L5)
- [api/index.ts:1-21](file://phoenix-backend/api/index.ts#L1-L21)
- [src/app.ts:1-33](file://phoenix-backend/src/app.ts#L1-L33)
- [src/server.ts:1-32](file://phoenix-backend/src/server.ts#L1-L32)
- [src/config.ts:1-41](file://phoenix-backend/src/config.ts#L1-L41)
- [src/db.ts:1-36](file://phoenix-backend/src/db.ts#L1-L36)
- [src/lib/http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)
- [src/lib/auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)
- [src/lib/schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [src/lib/cache.ts:1-26](file://phoenix-backend/src/lib/cache.ts#L1-L26)
- [src/routes/health.ts:1-27](file://phoenix-backend/src/routes/health.ts#L1-L27)
- [src/routes/auth.ts:1-52](file://phoenix-backend/src/routes/auth.ts#L1-L52)
- [src/routes/workspaces.ts:1-128](file://phoenix-backend/src/routes/workspaces.ts#L1-L128)
- [src/routes/projects.ts:1-58](file://phoenix-backend/src/routes/projects.ts#L1-L58)
- [src/routes/tasks.ts:1-127](file://phoenix-backend/src/routes/tasks.ts#L1-L127)

**Section sources**
- [README.md:1-76](file://phoenix-backend/README.md#L1-L76)
- [package.json:1-41](file://phoenix-backend/package.json#L1-L41)

## Core Components
- Express application factory:
  - Creates the Express app, disables server headers, enables proxy trust, configures CORS, body parsing, registers routers, and installs global error handlers.
- Serverless handler:
  - Reuses a single Express app instance per warm container and reuses the database connection promise to avoid repeated connections.
- Configuration manager:
  - Validates environment variables using a strict schema, caches parsed settings, and computes derived values like allowed CORS origins.
- Database connector:
  - Manages a single Mongoose default connection, ensures idempotent connect calls, initializes models, and provides disconnect for graceful shutdowns.
- HTTP utilities:
  - Provides async handler wrapper, Zod-based body parsing, ObjectId validation, regex escaping, duplicate key detection, not-found fallback, and centralized error handling.
- Authentication middleware:
  - Validates bearer tokens, loads current user, enforces workspace membership and roles (member/admin/owner), and resolves project access by workspace membership.
- Request schemas:
  - Centralized Zod schemas for all inputs across routes.
- In-process cache:
  - Lightweight TTL cache keyed by workspace for read-mostly endpoints.

**Section sources**
- [src/app.ts:11-31](file://phoenix-backend/src/app.ts#L11-L31)
- [api/index.ts:6-19](file://phoenix-backend/api/index.ts#L6-L19)
- [src/config.ts:4-40](file://phoenix-backend/src/config.ts#L4-L40)
- [src/db.ts:6-35](file://phoenix-backend/src/db.ts#L6-L35)
- [src/lib/http.ts:5-80](file://phoenix-backend/src/lib/http.ts#L5-L80)
- [src/lib/auth.ts:8-57](file://phoenix-backend/src/lib/auth.ts#L8-L57)
- [src/lib/schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [src/lib/cache.ts:1-26](file://phoenix-backend/src/lib/cache.ts#L1-L26)

## Architecture Overview
The system follows a layered design:
- HTTP layer: Express app with CORS, JSON body parser, and router registration.
- Middleware layer: Authentication and authorization helpers applied per route or globally within route groups.
- Route handlers: Feature-specific routers that validate input, enforce permissions, and perform business logic.
- Service/data layer: Mongoose models and ledger operations for multi-tenant data and credit accounting.
- Cross-cutting concerns: Validation, error normalization, caching, and configuration.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Vercel as "Vercel Router"
participant Handler as "api/index.ts"
participant App as "src/app.ts"
participant MW as "Middleware<br/>CORS + Body Parser"
participant Router as "Feature Routers"
participant DB as "MongoDB"
Client->>Vercel : HTTP Request
Vercel->>Handler : Invoke serverless function
Handler->>App : createApp() (cached)
Handler->>Handler : connectDb() (cached promise)
Handler->>App : expressApp(req,res)
App->>MW : Apply CORS + JSON parser
MW->>Router : Dispatch to matching route
Router->>DB : Query / Update
DB-->>Router : Data
Router-->>App : JSON Response
App-->>Client : HTTP Response
```

**Diagram sources**
- [vercel.json:1-5](file://phoenix-backend/vercel.json#L1-L5)
- [api/index.ts:11-19](file://phoenix-backend/api/index.ts#L11-L19)
- [src/app.ts:11-31](file://phoenix-backend/src/app.ts#L11-L31)
- [src/db.ts:13-29](file://phoenix-backend/src/db.ts#L13-L29)

## Detailed Component Analysis

### Express Application and Middleware Pipeline
- The application factory configures:
  - Security: disables x-powered-by, trusts reverse proxy headers.
  - CORS: configured from validated settings.
  - Body parsing: JSON with size limit before any route handler.
  - Routers: health, auth, workspaces, projects, tasks.
  - Global error handling: notFound and errorHandler at the end.

```mermaid
flowchart TD
Start(["createApp"]) --> Disable["Disable 'x-powered-by'"]
Disable --> TrustProxy["Set 'trust proxy'"]
TrustProxy --> CORS["Apply CORS"]
CORS --> BodyParser["Parse JSON (limit 100kb)"]
BodyParser --> RegisterHealth["Register health router"]
RegisterHealth --> RegisterAuth["Register auth router"]
RegisterAuth --> RegisterWorkspaces["Register workspaces router"]
RegisterWorkspaces --> RegisterProjects["Register projects router"]
RegisterProjects --> RegisterTasks["Register tasks router"]
RegisterTasks --> NotFound["notFound handler"]
NotFound --> ErrorHandler["errorHandler"]
ErrorHandler --> End(["Return Express app"])
```

**Diagram sources**
- [src/app.ts:11-31](file://phoenix-backend/src/app.ts#L11-L31)

**Section sources**
- [src/app.ts:11-31](file://phoenix-backend/src/app.ts#L11-L31)

### Serverless Deployment on Vercel
- All requests are rewritten to the serverless function via vercel.json.
- The handler:
  - Lazily creates and caches the Express app instance.
  - Ensures the database connection is established once per warm container.
  - Invokes the Express app directly without listening on a port.

```mermaid
sequenceDiagram
participant Vercel as "Vercel Runtime"
participant Handler as "api/index.ts"
participant App as "Express App"
participant DB as "Mongoose"
Vercel->>Handler : First invocation
Handler->>Handler : app = createApp()
Handler->>DB : connectDb(MONGODB_URI)
DB-->>Handler : Connected
Vercel->>Handler : Subsequent invocations
Handler->>App : app(req,res)
```

**Diagram sources**
- [vercel.json:1-5](file://phoenix-backend/vercel.json#L1-L5)
- [api/index.ts:6-19](file://phoenix-backend/api/index.ts#L6-L19)

**Section sources**
- [vercel.json:1-5](file://phoenix-backend/vercel.json#L1-L5)
- [api/index.ts:1-21](file://phoenix-backend/api/index.ts#L1-L21)

### Environment Configuration Management
- Strict schema validation for all environment variables.
- Cached parsed settings to avoid repeated parsing.
- Derived fields computed (e.g., CORS origin list).

```mermaid
flowchart TD
LoadEnv["Load .env"] --> Validate["Zod Schema Validation"]
Validate --> Success{"Valid?"}
Success --> |No| ThrowErr["Throw configuration error"]
Success --> |Yes| ParseOrigins["Parse CORS_ORIGINS"]
ParseOrigins --> CacheSettings["Cache Settings Object"]
CacheSettings --> Return["getSettings() returns cached"]
```

**Diagram sources**
- [src/config.ts:4-40](file://phoenix-backend/src/config.ts#L4-L40)

**Section sources**
- [src/config.ts:1-41](file://phoenix-backend/src/config.ts#L1-L41)

### Database Connection Management
- Single default Mongoose connection reused across invocations.
- Idempotent connect with pending promise deduplication.
- Model initialization after connection established.
- Graceful disconnect for shutdown.

```mermaid
flowchart TD
CallConnect["connectDb(uri)"] --> CheckReady{"readyState == connected?"}
CheckReady --> |Yes| ReturnOK["Return immediately"]
CheckReady --> |No| InitConnect["Start mongoose.connect()"]
InitConnect --> InitModels["Init ALL_MODELS"]
InitModels --> Done["Resolve connecting promise"]
Done --> Await["Await connection"]
```

**Diagram sources**
- [src/db.ts:6-35](file://phoenix-backend/src/db.ts#L6-L35)

**Section sources**
- [src/db.ts:1-36](file://phoenix-backend/src/db.ts#L1-L36)

### Authentication and Authorization
- Bearer token validation and user resolution.
- Workspace membership checks with consistent 404 semantics to avoid information leakage.
- Role enforcement for admin and owner actions.
- Project access resolved through workspace membership.

```mermaid
classDiagram
class AuthMiddleware {
+requireUser(req,res,next)
+currentUser(locals) CurrentUser
+requireMember(workspaceId,user)
+requireAdmin(workspaceId,user)
+requireOwner(workspaceId,user)
+getProjectForUser(projectId,user)
}
class User {
+_id
+email
+fullName
}
class WorkspaceMember {
+workspace
+user
+role
}
class Project {
+_id
+workspace
}
AuthMiddleware --> User : "loads"
AuthMiddleware --> WorkspaceMember : "checks membership"
AuthMiddleware --> Project : "resolves by workspace"
```

**Diagram sources**
- [src/lib/auth.ts:8-57](file://phoenix-backend/src/lib/auth.ts#L8-L57)

**Section sources**
- [src/lib/auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)

### Request Validation and Error Handling
- Zod schemas define strict contracts for all inputs.
- parseBody throws structured errors for invalid payloads.
- parseId validates MongoDB ObjectIds and returns 404 for malformed IDs.
- Centralized errorHandler normalizes domain errors, validation errors, cast errors, syntax errors, and body-parser errors into consistent JSON responses.

```mermaid
flowchart TD
Req["Incoming Request"] --> Validate["parseBody(schema)"]
Validate --> Valid{"Valid?"}
Valid --> |No| Err422["HttpError(422)"]
Valid --> |Yes| Next["Proceed to handler"]
Next --> Exec["Handler execution"]
Exec --> Catch{"Exception?"}
Catch --> |Yes| HandleErr["errorHandler(err)"]
HandleErr --> Resp["JSON response"]
Catch --> |No| Resp
```

**Diagram sources**
- [src/lib/http.ts:20-80](file://phoenix-backend/src/lib/http.ts#L20-L80)
- [src/lib/schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)

**Section sources**
- [src/lib/http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)
- [src/lib/schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)

### Route Organization and Business Logic

#### Health Endpoint
- Pings MongoDB to report real connectivity status.

```mermaid
flowchart TD
Start(["GET /api/health"]) --> CheckConn["Check readyState and ping admin"]
CheckConn --> Status{"Ping ok?"}
Status --> |Yes| Ok["200 {status:'ok', db:'ok'}"]
Status --> |No| Down["503 {status:'error', db:'down'}"]
```

**Diagram sources**
- [src/routes/health.ts:11-26](file://phoenix-backend/src/routes/health.ts#L11-L26)

**Section sources**
- [src/routes/health.ts:1-27](file://phoenix-backend/src/routes/health.ts#L1-L27)

#### Authentication Routes
- Registration and login return JWT access tokens and user payload.
- Protected profile endpoint requires valid bearer token.

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "authRouter"
participant U as "User Model"
participant S as "Security Utils"
C->>R : POST /api/auth/register
R->>U : Create user
R->>S : createAccessToken(userId)
R-->>C : {access_token, token_type, user}
C->>R : POST /api/auth/login
R->>U : Find by email
R->>S : verifyPassword
R->>S : createAccessToken(userId)
R-->>C : {access_token, token_type, user}
C->>R : GET /api/auth/me (Bearer)
R->>R : requireUser
R-->>C : {user}
```

**Diagram sources**
- [src/routes/auth.ts:11-51](file://phoenix-backend/src/routes/auth.ts#L11-L51)

**Section sources**
- [src/routes/auth.ts:1-52](file://phoenix-backend/src/routes/auth.ts#L1-L52)

#### Workspaces Routes
- List, create, get, manage members, view credits, top-up credits.
- Enforces role-based access: member, admin, owner.
- Uses CreditLedger for auditability.

```mermaid
flowchart TD
WS_Create["POST /workspaces"] --> InitWS["Create Workspace + Owner Member + Welcome Credits"]
WS_Members["POST /workspaces/:id/members"] --> AdminCheck{"Admin?"}
AdminCheck --> |Yes| AddMember["Add member with role"]
AdminCheck --> |No| Deny["403 Forbidden"]
WS_TopUp["POST /workspaces/:id/credits/topup"] --> OwnerCheck{"Owner?"}
OwnerCheck --> |Yes| IncCredits["Increment credits + Ledger"]
OwnerCheck --> |No| Deny
```

**Diagram sources**
- [src/routes/workspaces.ts:31-127](file://phoenix-backend/src/routes/workspaces.ts#L31-L127)

**Section sources**
- [src/routes/workspaces.ts:1-128](file://phoenix-backend/src/routes/workspaces.ts#L1-L128)

#### Projects Routes
- List projects per workspace with in-process cache.
- Create project invalidates cache.
- Get project by ID enforces workspace membership.

```mermaid
flowchart TD
List["GET /workspaces/:wsId/projects"] --> Auth["requireUser + requireMember"]
Auth --> CacheHit{"Cache hit?"}
CacheHit --> |Yes| ReturnCached["Return cached list"]
CacheHit --> |No| Fetch["Query projects"]
Fetch --> SetCache["cacheSet(key, result)"]
SetCache --> ReturnData["Return data"]
Create["POST /workspaces/:wsId/projects"] --> Invalidate["cacheDelete(key)"]
```

**Diagram sources**
- [src/routes/projects.ts:11-45](file://phoenix-backend/src/routes/projects.ts#L11-L45)
- [src/lib/cache.ts:5-24](file://phoenix-backend/src/lib/cache.ts#L5-L24)

**Section sources**
- [src/routes/projects.ts:1-58](file://phoenix-backend/src/routes/projects.ts#L1-L58)
- [src/lib/cache.ts:1-26](file://phoenix-backend/src/lib/cache.ts#L1-L26)

#### Tasks Routes
- List tasks with pagination, filtering, and stable ordering.
- Create task costs credits, uses atomic decrement, idempotency key support, and ledger entries.
- Refund logic ensures consistency if task creation fails.

```mermaid
flowchart TD
Start(["POST /projects/:projectId/tasks"]) --> Auth["requireUser + getProjectForUser"]
Auth --> Parse["parseBody(TaskIn)"]
Parse --> IdemCheck{"Idempotency-Key present?"}
IdemCheck --> |Yes| Replay["Find ledger by key"]
Replay --> Found{"Task exists?"}
Found --> |Yes| ReturnExisting["Return existing task"]
Found --> |No| Proceed["Continue"]
IdemCheck --> |No| Proceed
Proceed --> AssigneeCheck{"assignee_id provided?"}
AssigneeCheck --> |Yes| ValidateAssignee["Check assignee is member"]
ValidateAssignee --> Spend["Atomic $gte + $inc credits"]
AssigneeCheck --> |No| Spend
Spend --> Enough{"Enough credits?"}
Enough --> |No| Fail402["402 Not enough credits"]
Enough --> |Yes| CreateTask["Create Task"]
CreateTask --> TryLedger["Create CreditLedger entry"]
TryLedger --> Success["201 Created"]
TryLedger --> |Error| Rollback["Delete task + refund credits"]
Rollback --> DuplicateKey{"Duplicate key?"}
DuplicateKey --> |Yes| ReplayAgain["Replay key -> existing task"]
DuplicateKey --> |No| Propagate["Propagate error"]
```

**Diagram sources**
- [src/routes/tasks.ts:38-125](file://phoenix-backend/src/routes/tasks.ts#L38-L125)

**Section sources**
- [src/routes/tasks.ts:1-127](file://phoenix-backend/src/routes/tasks.ts#L1-L127)

## Dependency Analysis
High-level dependencies between modules:

```mermaid
graph LR
App["src/app.ts"] --> Config["src/config.ts"]
App --> Http["src/lib/http.ts"]
App --> Routes["Routes"]
Routes --> AuthLib["src/lib/auth.ts"]
Routes --> Schemas["src/lib/schemas.ts"]
Routes --> Cache["src/lib/cache.ts"]
App --> DB["src/db.ts"]
```

**Diagram sources**
- [src/app.ts:1-33](file://phoenix-backend/src/app.ts#L1-L33)
- [src/config.ts:1-41](file://phoenix-backend/src/config.ts#L1-L41)
- [src/lib/http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)
- [src/lib/auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)
- [src/lib/schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [src/lib/cache.ts:1-26](file://phoenix-backend/src/lib/cache.ts#L1-L26)
- [src/db.ts:1-36](file://phoenix-backend/src/db.ts#L1-L36)

**Section sources**
- [src/app.ts:1-33](file://phoenix-backend/src/app.ts#L1-L33)

## Performance Considerations
- Connection pooling and reuse:
  - Mongoose default connection is reused; connectDb is idempotent and caches the connecting promise to prevent concurrent connection storms.
- Serverless cold starts:
  - Express app and database connection are created once per warm container; subsequent invocations reuse them to minimize latency.
- Caching strategy:
  - In-process TTL cache for read-mostly endpoints (e.g., project lists per workspace). Keys are scoped to workspace to respect multi-tenancy.
- Memory management:
  - Avoid storing large objects in cache; keep TTL short for hot data.
  - Ensure no long-lived references outside the request scope to allow garbage collection.
- Request size limits:
  - JSON body parser limited to 100KB to protect against oversized payloads.
- Database query efficiency:
  - Use lean queries where possible, selective field projection (e.g., credits-only reads), and stable sort keys for pagination.
- Atomic operations:
  - Credit spending uses atomic updates to prevent race conditions and ensure financial consistency.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Invalid environment configuration:
  - Missing or malformed env vars cause startup failure due to strict schema validation. Verify required variables and formats.
- Database connectivity:
  - Health endpoint returns 503 when MongoDB is unreachable. Check network access rules and connection string.
- Authentication failures:
  - 401 indicates missing/invalid bearer token or expired token. Ensure client sends Authorization header correctly.
- Authorization denials:
  - 403 indicates insufficient role (admin/owner). Confirm user’s role in the workspace.
- Resource not found:
  - 404 for malformed IDs or non-existent resources. IDs must be 24-hex ObjectIds.
- Validation errors:
  - 422 for malformed request bodies. Inspect Zod error details in the response.
- Body too large:
  - 413 when request exceeds 100KB. Reduce payload size or adjust limits if necessary.
- Duplicate keys:
  - 409 for duplicate emails or memberships. Normalize inputs and handle conflicts gracefully.

**Section sources**
- [src/config.ts:28-40](file://phoenix-backend/src/config.ts#L28-L40)
- [src/routes/health.ts:11-26](file://phoenix-backend/src/routes/health.ts#L11-L26)
- [src/lib/http.ts:42-80](file://phoenix-backend/src/lib/http.ts#L42-L80)
- [src/lib/auth.ts:8-57](file://phoenix-backend/src/lib/auth.ts#L8-L57)
- [src/routes/auth.ts:11-51](file://phoenix-backend/src/routes/auth.ts#L11-L51)
- [src/routes/workspaces.ts:77-101](file://phoenix-backend/src/routes/workspaces.ts#L77-L101)

## Conclusion
Phoenix’s backend implements a clean, modular Express architecture suited for serverless deployment. It separates concerns across configuration, database management, shared libraries, and feature routes. Robust validation, centralized error handling, and careful permission checks provide security and reliability. Performance is optimized through connection reuse, targeted caching, and atomic operations, while maintaining clear operational signals via health checks and consistent error responses.