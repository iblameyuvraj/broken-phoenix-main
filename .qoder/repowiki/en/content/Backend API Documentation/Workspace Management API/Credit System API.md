# Credit System API

<cite>
**Referenced Files in This Document**
- [workspaces.ts](file://phoenix-backend/src/routes/workspaces.ts)
- [tasks.ts](file://phoenix-backend/src/routes/tasks.ts)
- [ledger.ts](file://phoenix-backend/src/models/ledger.ts)
- [workspace.ts](file://phoenix-backend/src/models/workspace.ts)
- [schemas.ts](file://phoenix-backend/src/lib/schemas.ts)
- [auth.ts](file://phoenix-backend/src/lib/auth.ts)
- [http.ts](file://phoenix-backend/src/lib/http.ts)
- [config.ts](file://phoenix-backend/src/config.ts)
- [page.tsx](file://phoenix-frontend/src/app/workspaces/[id]/page.tsx)
- [smoke.test.ts](file://phoenix-backend/tests/smoke.test.ts)
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
This document explains the workspace credit system endpoints used to check and top up workspace credits, how credits relate to task creation costs, and how changes are recorded through the credit ledger. It also covers authorization requirements, request and response schemas, error handling, and practical workflows such as initial welcome credits and manual top-ups.

## Project Structure
The credit-related logic is implemented in the backend Express application:
- Workspace routes define credit balance retrieval and top-up endpoints.
- Task routes deduct credits when creating tasks.
- Models define workspaces, members, and the append-only credit ledger.
- Shared libraries provide authentication, HTTP helpers, Zod-based validation, and configuration.
- The frontend demonstrates a user interface for topping up credits.

```mermaid
graph TB
subgraph "Backend"
WS["Workspace Routes<br/>GET /api/workspaces/:workspaceId/credits<br/>POST /api/workspaces/:workspaceId/credits/topup"]
TS["Task Routes<br/>POST /api/projects/:projectId/tasks"]
CFG["Configuration<br/>TASK_CREDIT_COST, WELCOME_CREDITS"]
AUTH["Auth Middleware<br/>requireUser, requireOwner"]
HTTP["HTTP Helpers<br/>parseBody, parseId, HttpError"]
MODEL_WS["Workspace Model<br/>credits field"]
MODEL_LEDGER["CreditLedger Model<br/>append-only history"]
end
subgraph "Frontend"
UI["Workspace Detail Page<br/>Top-up form"]
end
UI --> WS
WS --> AUTH
WS --> HTTP
WS --> MODEL_WS
WS --> MODEL_LEDGER
TS --> CFG
TS --> MODEL_WS
TS --> MODEL_LEDGER
WS --> CFG
```

**Diagram sources**
- [workspaces.ts:104-127](file://phoenix-backend/src/routes/workspaces.ts#L104-L127)
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)
- [auth.ts:8-50](file://phoenix-backend/src/lib/auth.ts#L8-L50)
- [http.ts:20-32](file://phoenix-backend/src/lib/http.ts#L20-L32)
- [workspace.ts:5-13](file://phoenix-backend/src/models/workspace.ts#L5-L13)
- [ledger.ts:4-18](file://phoenix-backend/src/models/ledger.ts#L4-L18)
- [page.tsx:10-49](file://phoenix-frontend/src/app/workspaces/[id]/page.tsx#L10-L49)

**Section sources**
- [workspaces.ts:104-127](file://phoenix-backend/src/routes/workspaces.ts#L104-L127)
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)
- [auth.ts:8-50](file://phoenix-backend/src/lib/auth.ts#L8-L50)
- [http.ts:20-32](file://phoenix-backend/src/lib/http.ts#L20-L32)
- [workspace.ts:5-13](file://phoenix-backend/src/models/workspace.ts#L5-L13)
- [ledger.ts:4-18](file://phoenix-backend/src/models/ledger.ts#L4-L18)
- [page.tsx:10-49](file://phoenix-frontend/src/app/workspaces/[id]/page.tsx#L10-L49)

## Core Components
- GET /api/workspaces/:workspaceId/credits
  - Purpose: Return the current workspace credit balance.
  - Authorization: Requires an authenticated user who is a member of the workspace.
  - Behavior: Validates the workspace ID, checks membership, and returns only the credits field from the workspace.

- POST /api/workspaces/:workspaceId/credits/topup
  - Purpose: Add credits to a workspace balance.
  - Authorization: Requires an authenticated user with owner role on the workspace.
  - Validation: Amount must be a positive integer not greater than 1000.
  - Side effects: Atomically increments the workspace credits and creates an append-only ledger entry with reason “top-up”.
  - Response: Returns the updated workspace ID and balance.

- Relationship to task creation
  - Creating a task deducts TASK_CREDIT_COST credits from the project’s workspace.
  - Deduction is atomic using a conditional update that fails if insufficient credits exist.
  - Successful task creation records a negative delta in the credit ledger, optionally linked to the created task and idempotency key.

- Initial welcome credits
  - When a workspace is created, it receives WELCOME_CREDITS and a corresponding ledger entry with reason “welcome credits”.

**Section sources**
- [workspaces.ts:104-127](file://phoenix-backend/src/routes/workspaces.ts#L104-L127)
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)
- [workspace.ts:5-13](file://phoenix-backend/src/models/workspace.ts#L5-L13)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)

## Architecture Overview
The credit system integrates routing, middleware, models, and configuration:

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "Workspace Router"
participant Auth as "Auth Middleware"
participant DB as "Database"
participant Ledger as "CreditLedger Model"
Client->>Router : "GET /api/workspaces/ : workspaceId/credits"
Router->>Auth : "requireUser + requireMember"
Auth-->>Router : "Authenticated member"
Router->>DB : "Find workspace credits"
DB-->>Router : "Credits value"
Router-->>Client : "{ workspace_id, balance }"
Client->>Router : "POST /api/workspaces/ : workspaceId/credits/topup { amount }"
Router->>Auth : "requireUser + requireOwner"
Auth-->>Router : "Authenticated owner"
Router->>DB : "Increment workspace credits"
DB-->>Router : "Updated workspace"
Router->>Ledger : "Create ledger entry (reason : top-up)"
Ledger-->>Router : "Created"
Router-->>Client : "{ workspace_id, balance }"
```

**Diagram sources**
- [workspaces.ts:104-127](file://phoenix-backend/src/routes/workspaces.ts#L104-L127)
- [auth.ts:8-50](file://phoenix-backend/src/lib/auth.ts#L8-L50)
- [ledger.ts:4-18](file://phoenix-backend/src/models/ledger.ts#L4-L18)

## Detailed Component Analysis

### GET /api/workspaces/:workspaceId/credits
- Path parameters
  - workspaceId: A valid 24-character hexadecimal MongoDB ObjectId. Invalid IDs return 404.
- Authorization
  - Bearer token required.
  - Caller must be a member of the workspace; otherwise, a 404 is returned to avoid leaking existence.
- Request schema
  - No body.
- Response schema
  - workspace_id: string
  - balance: number
- Error handling
  - 401: Missing or invalid/expired token.
  - 404: Invalid workspace ID or caller is not a member.
  - 422: Malformed path or query parsing errors handled by shared HTTP error handler.

```mermaid
flowchart TD
Start(["Request"]) --> ParseId["Parse workspaceId"]
ParseId --> CheckMember["Check workspace membership"]
CheckMember --> |Not member| NotFound["Return 404"]
CheckMember --> |Member| FetchBalance["Fetch workspace.credits"]
FetchBalance --> Respond["Return { workspace_id, balance }"]
```

**Diagram sources**
- [workspaces.ts:104-113](file://phoenix-backend/src/routes/workspaces.ts#L104-L113)
- [http.ts:28-32](file://phoenix-backend/src/lib/http.ts#L28-L32)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

**Section sources**
- [workspaces.ts:104-113](file://phoenix-backend/src/routes/workspaces.ts#L104-L113)
- [http.ts:28-32](file://phoenix-backend/src/lib/http.ts#L28-L32)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

### POST /api/workspaces/:workspaceId/credits/topup
- Path parameters
  - workspaceId: A valid 24-character hexadecimal MongoDB ObjectId.
- Authorization
  - Bearer token required.
  - Caller must have owner role on the workspace; otherwise, a 403 is returned.
- Request schema
  - amount: integer, positive, maximum 1000.
- Response schema
  - workspace_id: string
  - balance: number
- Processing steps
  - Validate amount using TopUpIn schema.
  - Increment workspace credits atomically.
  - Create a ledger entry with reason “top-up”.
  - Return updated balance.

```mermaid
flowchart TD
Start(["Request"]) --> ParseId["Parse workspaceId"]
ParseId --> RequireOwner["Require owner role"]
RequireOwner --> |Not owner| Forbidden["Return 403"]
RequireOwner --> ValidateAmount["Validate amount (positive int ≤ 1000)"]
ValidateAmount --> |Invalid| Unprocessable["Return 422"]
ValidateAmount --> UpdateCredits["Increment workspace.credits"]
UpdateCredits --> RecordLedger["Create ledger entry (reason: top-up)"]
RecordLedger --> Respond["Return { workspace_id, balance }"]
```

**Diagram sources**
- [workspaces.ts:115-127](file://phoenix-backend/src/routes/workspaces.ts#L115-L127)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)
- [auth.ts:44-50](file://phoenix-backend/src/lib/auth.ts#L44-L50)

**Section sources**
- [workspaces.ts:115-127](file://phoenix-backend/src/routes/workspaces.ts#L115-L127)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)
- [auth.ts:44-50](file://phoenix-backend/src/lib/auth.ts#L44-L50)

### Relationship Between Workspace Credits and Task Creation Costs
- Cost model
  - Each task creation deducts TASK_CREDIT_COST credits from the project’s workspace.
  - Default cost is 1, configurable via environment variable.
- Atomic deduction
  - Uses a conditional update ensuring sufficient credits before decrementing.
  - If insufficient credits, returns 402 Payment Required.
- Idempotency
  - Optional Idempotency-Key header allows safe retries without double-charging.
  - If a prior successful operation exists for the same key, the original task is returned without additional deduction.
- Ledger recording
  - Successful task creation records a negative delta in the credit ledger, optionally linking to the created task.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Tasks as "Task Route"
participant Config as "Config"
participant DB as "Database"
participant Ledger as "CreditLedger Model"
Client->>Tasks : "POST /api/projects/ : projectId/tasks { title, assignee_id? }"
Tasks->>Config : "Read TASK_CREDIT_COST"
Tasks->>DB : "Conditional update : credits >= cost ? decrement"
DB-->>Tasks : "Updated workspace or null"
alt Insufficient credits
Tasks-->>Client : "402 Not enough credits"
else Success
Tasks->>Ledger : "Create ledger entry (negative delta, reason : task creation)"
Ledger-->>Tasks : "Created"
Tasks-->>Client : "201 Created task"
end
```

**Diagram sources**
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)
- [ledger.ts:4-18](file://phoenix-backend/src/models/ledger.ts#L4-L18)

**Section sources**
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)
- [ledger.ts:4-18](file://phoenix-backend/src/models/ledger.ts#L4-L18)

### Data Models and Schemas
- Workspace
  - Contains name, owner reference, and credits (non-negative).
- CreditLedger
  - Append-only record of credit changes with fields: workspace, delta, reason, optional task reference, and optional idempotencyKey.
- Input Schemas
  - TopUpIn enforces amount as a positive integer with a maximum of 1000.

```mermaid
classDiagram
class Workspace {
+string name
+ObjectId owner
+number credits
}
class CreditLedger {
+ObjectId workspace
+number delta
+string reason
+ObjectId task
+string idempotencyKey
}
class TopUpIn {
+number amount
}
Workspace "1" o-- "*" CreditLedger : "has many entries"
```

**Diagram sources**
- [workspace.ts:5-13](file://phoenix-backend/src/models/workspace.ts#L5-L13)
- [ledger.ts:4-18](file://phoenix-backend/src/models/ledger.ts#L4-L18)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)

**Section sources**
- [workspace.ts:5-13](file://phoenix-backend/src/models/workspace.ts#L5-L13)
- [ledger.ts:4-18](file://phoenix-backend/src/models/ledger.ts#L4-L18)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)

### Frontend Integration Example
- The workspace detail page includes a top-up form that calls the top-up endpoint with an amount between 1 and 1000.
- On success, it displays a confirmation message and refreshes state.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "Workspace Detail Page"
participant API as "Top-up Endpoint"
User->>UI : "Enter amount and submit"
UI->>API : "POST /api/workspaces/ : workspaceId/credits/topup { amount }"
API-->>UI : "{ workspace_id, balance }"
UI-->>User : "Show success message"
```

**Diagram sources**
- [page.tsx:10-49](file://phoenix-frontend/src/app/workspaces/[id]/page.tsx#L10-L49)

**Section sources**
- [page.tsx:10-49](file://phoenix-frontend/src/app/workspaces/[id]/page.tsx#L10-L49)

## Dependency Analysis
- Authorization dependencies
  - requireUser validates bearer tokens and loads the current user.
  - requireMember ensures the user belongs to the workspace; non-members receive 404.
  - requireOwner restricts top-ups to workspace owners.
- Validation dependencies
  - parseBody uses Zod schemas; invalid payloads return 422 with structured error details.
  - parseId rejects malformed workspace IDs with 404.
- Configuration dependencies
  - TASK_CREDIT_COST controls task creation cost.
  - WELCOME_CREDITS sets initial credits upon workspace creation.

```mermaid
graph LR
Auth["Auth Middleware"] --> Workspaces["Workspace Routes"]
HTTP["HTTP Helpers"] --> Workspaces
Schemas["Zod Schemas"] --> Workspaces
Config["Configuration"] --> Workspaces
Config --> Tasks["Task Routes"]
Models["Models"] --> Workspaces
Models --> Tasks
```

**Diagram sources**
- [auth.ts:8-50](file://phoenix-backend/src/lib/auth.ts#L8-L50)
- [http.ts:20-32](file://phoenix-backend/src/lib/http.ts#L20-L32)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)
- [workspaces.ts:104-127](file://phoenix-backend/src/routes/workspaces.ts#L104-L127)
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)

**Section sources**
- [auth.ts:8-50](file://phoenix-backend/src/lib/auth.ts#L8-L50)
- [http.ts:20-32](file://phoenix-backend/src/lib/http.ts#L20-L32)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)
- [workspaces.ts:104-127](file://phoenix-backend/src/routes/workspaces.ts#L104-L127)
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)

## Performance Considerations
- Use minimal projection when reading balances to reduce payload size.
- Prefer atomic updates for credit changes to avoid race conditions.
- Leverage indexes on workspace references in the ledger for efficient queries.
- Avoid unnecessary population of related documents when returning balances.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common errors and their causes:
- 401 Not authenticated
  - Missing or invalid Authorization header.
- 401 Invalid or expired token
  - Token cannot be decoded or user no longer exists.
- 404 Workspace not found
  - Invalid workspace ID or caller is not a member.
- 403 Owner role required
  - Attempted top-up by a non-owner.
- 422 Validation error
  - Invalid amount type, out-of-range value, or malformed JSON.
- 402 Not enough credits
  - Attempted task creation when workspace credits are below TASK_CREDIT_COST.

Operational tips:
- Verify JWT_SECRET and algorithm settings if authentication fails unexpectedly.
- Ensure TASK_CREDIT_COST and WELCOME_CREDITS are set correctly in environment variables.
- Review ledger entries to trace credit changes and reconcile discrepancies.

**Section sources**
- [http.ts:47-80](file://phoenix-backend/src/lib/http.ts#L47-L80)
- [auth.ts:8-50](file://phoenix-backend/src/lib/auth.ts#L8-L50)
- [tasks.ts:38-81](file://phoenix-backend/src/routes/tasks.ts#L38-L81)
- [config.ts:4-14](file://phoenix-backend/src/config.ts#L4-L14)

## Conclusion
The workspace credit system provides secure, auditable management of workspace credits:
- Members can read balances; only owners can add credits.
- Top-ups increment balances and create immutable ledger entries.
- Task creation deducts configurable credits atomically and records the change in the ledger.
- Initial welcome credits ensure new workspaces start with a usable balance.
- Robust validation and error handling protect against misuse and provide clear feedback to clients.

[No sources needed since this section summarizes without analyzing specific files]