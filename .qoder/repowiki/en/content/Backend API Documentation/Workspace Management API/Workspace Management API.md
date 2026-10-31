# Workspace Management API

<cite>
**Referenced Files in This Document**
- [workspaces.ts](file://phoenix-backend/src/routes/workspaces.ts)
- [workspace.ts](file://phoenix-backend/src/models/workspace.ts)
- [user.ts](file://phoenix-backend/src/models/user.ts)
- [ledger.ts](file://phoenix-backend/src/models/ledger.ts)
- [schemas.ts](file://phoenix-backend/src/lib/schemas.ts)
- [auth.ts](file://phoenix-backend/src/lib/auth.ts)
- [http.ts](file://phoenix-backend/src/lib/http.ts)
- [config.ts](file://phoenix-backend/src/config.ts)
- [README.md](file://phoenix-backend/README.md)
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
This document provides comprehensive API documentation for workspace management endpoints in the Phoenix backend. It covers:
- Workspace listing, creation, and retrieval
- Member management (listing and inviting members)
- Role-based access control (owner, admin, member)
- Credit operations (balance checking and top-up)

The API is a multi-tenant system where users belong to workspaces with roles that determine permissions. All JSON responses use snake_case identifiers and error bodies follow a consistent format.

## Project Structure
The workspace-related functionality lives primarily under the backend routes and models:
- Routes define HTTP endpoints and authorization checks
- Models define data schemas for workspaces, members, users, and credit ledger entries
- Shared libraries provide authentication, validation, and error handling utilities

```mermaid
graph TB
Client["Client"] --> Router["Express Router<br/>workspaces.ts"]
Router --> Auth["Auth Middleware<br/>auth.ts"]
Router --> Schemas["Input Validation<br/>schemas.ts"]
Router --> DB_Workspace["Workspace Model<br/>workspace.ts"]
Router --> DB_Member["WorkspaceMember Model<br/>workspace.ts"]
Router --> DB_User["User Model<br/>user.ts"]
Router --> DB_Ledger["CreditLedger Model<br/>ledger.ts"]
Router --> Config["Settings<br/>config.ts"]
Router --> HttpUtils["HTTP Helpers<br/>http.ts"]
```

**Diagram sources**
- [workspaces.ts:1-128](file://phoenix-backend/src/routes/workspaces.ts#L1-L128)
- [workspace.ts:1-22](file://phoenix-backend/src/models/workspace.ts#L1-L22)
- [user.ts:1-20](file://phoenix-backend/src/models/user.ts#L1-L20)
- [ledger.ts:1-19](file://phoenix-backend/src/models/ledger.ts#L1-L19)
- [schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)
- [http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)
- [config.ts:1-41](file://phoenix-backend/src/config.ts#L1-L41)

**Section sources**
- [README.md:59-75](file://phoenix-backend/README.md#L59-L75)

## Core Components
- Workspaces: Represent tenant contexts with an owner and credits balance.
- Members: Map users to workspaces with roles (owner, admin, member).
- Users: Account entities identified by email and name.
- Credit Ledger: Append-only history of credit changes per workspace.
- Authorization: Bearer token-based authentication with role checks.
- Validation: Zod-based request body and ID parsing.
- Error Handling: Centralized HTTP error formatting and status mapping.

Key responsibilities:
- Route handlers enforce authorization and orchestrate database operations.
- Models define schema constraints and indexes.
- Libraries provide reusable auth, validation, and error utilities.

**Section sources**
- [workspace.ts:1-22](file://phoenix-backend/src/models/workspace.ts#L1-L22)
- [user.ts:1-20](file://phoenix-backend/src/models/user.ts#L1-L20)
- [ledger.ts:1-19](file://phoenix-backend/src/models/ledger.ts#L1-L19)
- [auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)
- [schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)

## Architecture Overview
The workspace management API follows a layered architecture:
- Express router defines endpoints and applies middleware for authentication and authorization.
- Route handlers validate inputs using Zod schemas and call Mongoose models.
- Data integrity is enforced via model schemas and unique indexes.
- Errors are normalized through centralized error handling.

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router<br/>workspaces.ts"
participant A as "Auth<br/>auth.ts"
participant V as "Validation<br/>schemas.ts"
participant D as "Database Models"
participant H as "Error Handler<br/>http.ts"
C->>R : HTTP Request
R->>A : requireUser / requireAdmin / requireOwner
A-->>R : Current User or 401/403
R->>V : parseBody(schema)
V-->>R : Parsed Data or 422
R->>D : Query/Update/Create
D-->>R : Result or DB Error
R-->>C : JSON Response
Note over R,H : Unhandled errors map to standardized JSON errors
```

**Diagram sources**
- [workspaces.ts:1-128](file://phoenix-backend/src/routes/workspaces.ts#L1-L128)
- [auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)
- [schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)

## Detailed Component Analysis

### Authentication and Authorization
- Authentication requires a Bearer token; invalid or missing tokens return 401.
- Authorization functions enforce workspace membership and role requirements:
  - requireMember: user must be a member of the workspace.
  - requireAdmin: user must be owner or admin.
  - requireOwner: user must be owner.
- If a user is not a member, endpoints return 404 to avoid leaking workspace existence.

```mermaid
flowchart TD
Start(["Request"]) --> CheckToken["Validate Bearer Token"]
CheckToken --> Valid{"Valid Token?"}
Valid --> |No| Err401["Return 401 Not authenticated"]
Valid --> |Yes| LoadUser["Load User from DB"]
LoadUser --> Exists{"User Exists?"}
Exists --> |No| Err401b["Return 401 User no longer exists"]
Exists --> |Yes| RoleCheck["Role Check<br/>requireMember/Admin/Owner"]
RoleCheck --> Allowed{"Allowed?"}
Allowed --> |No| Err403["Return 403 Role required"]
Allowed --> |Yes| Proceed["Proceed to Handler"]
```

**Diagram sources**
- [auth.ts:8-50](file://phoenix-backend/src/lib/auth.ts#L8-L50)

**Section sources**
- [auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)

### Input Validation and ID Parsing
- Request bodies are validated using Zod schemas:
  - WorkspaceIn: workspace name
  - MemberIn: email and role
  - TopUpIn: amount (positive integer, max 1000)
- Path IDs must be valid MongoDB ObjectIds; otherwise, a 404 is returned.
- Validation failures return 422 with structured issues.

```mermaid
flowchart TD
In(["Request Body"]) --> Validate["Zod Schema Validation"]
Validate --> Ok{"Valid?"}
Ok --> |No| Err422["Return 422 with issues"]
Ok --> |Yes| UseData["Use Parsed Data"]
Ids(["Path ID"]) --> ParseId["parseId()"]
ParseId --> IdOk{"Valid ObjectId?"}
IdOk --> |No| Err404["Return 404 Resource not found"]
IdOk --> |Yes| UseId["Use ObjectId"]
```

**Diagram sources**
- [schemas.ts:15-22](file://phoenix-backend/src/lib/schemas.ts#L15-L22)
- [http.ts:20-32](file://phoenix-backend/src/lib/http.ts#L20-L32)

**Section sources**
- [schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [http.ts:20-32](file://phoenix-backend/src/lib/http.ts#L20-L32)

### Error Handling
- Centralized error handler maps exceptions to standardized JSON responses:
  - HttpError: uses provided status and detail
  - ZodError: returns 422 with validation issues
  - Mongoose CastError: returns 404
  - Mongoose ValidationError: returns 422
  - SyntaxError on body: returns 400 malformed JSON
  - Body parser errors: map to appropriate client error codes
  - Unknown errors: log and return 500

```mermaid
flowchart TD
Throw(["Throw Error"]) --> Type{"Error Type"}
Type --> |HttpError| MapHttp["Map to {status, detail}"]
Type --> |ZodError| MapZod["Map to 422 + issues"]
Type --> |CastError| Map404["Map to 404 Not found"]
Type --> |ValidationError| Map422["Map to 422 message"]
Type --> |SyntaxError| Map400["Map to 400 Malformed JSON"]
Type --> |BodyParser| MapBP["Map to client error code"]
Type --> |Other| Map500["Log and return 500"]
```

**Diagram sources**
- [http.ts:42-81](file://phoenix-backend/src/lib/http.ts#L42-L81)

**Section sources**
- [http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)

### Data Models and Relationships
- Workspace: stores name, owner reference, and credits balance.
- WorkspaceMember: links users to workspaces with roles; enforces uniqueness per workspace-user pair.
- User: stores email, full name, and password hash.
- CreditLedger: append-only record of credit deltas with optional idempotency keys.

```mermaid
erDiagram
WORKSPACE {
string name
objectId owner_id FK
number credits
}
USER {
string email UK
string fullName
string passwordHash
}
WORKSPACE_MEMBER {
objectId workspace_id FK
objectId user_id FK
enum role
}
CREDIT_LEDGER {
objectId workspace_id FK
number delta
string reason
objectId task_id FK
string idempotency_key
}
USER ||--o{ WORKSPACE_MEMBER : "has memberships"
WORKSPACE ||--o{ WORKSPACE_MEMBER : "has members"
WORKSPACE ||--o{ CREDIT_LEDGER : "has ledger entries"
```

**Diagram sources**
- [workspace.ts:1-22](file://phoenix-backend/src/models/workspace.ts#L1-L22)
- [user.ts:1-20](file://phoenix-backend/src/models/user.ts#L1-L20)
- [ledger.ts:1-19](file://phoenix-backend/src/models/ledger.ts#L1-L19)

**Section sources**
- [workspace.ts:1-22](file://phoenix-backend/src/models/workspace.ts#L1-L22)
- [user.ts:1-20](file://phoenix-backend/src/models/user.ts#L1-L20)
- [ledger.ts:1-19](file://phoenix-backend/src/models/ledger.ts#L1-L19)

## Detailed Component Analysis

### Workspace Listing
- Endpoint: GET /api/workspaces
- Authorization: Requires authenticated user (Bearer token).
- Behavior:
  - Fetches all workspaces the current user is a member of.
  - Returns workspace details including role within each workspace.
- Response fields:
  - id: workspace identifier
  - name: workspace name
  - owner_id: owner user identifier
  - role: current user’s role in the workspace

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant A as "Auth"
participant M as "Models"
C->>R : GET /api/workspaces
R->>A : requireUser()
A-->>R : Current User
R->>M : Find memberships for user
R->>M : Find workspaces by IDs
R-->>C : Array of workspace objects with role
```

**Diagram sources**
- [workspaces.ts:18-29](file://phoenix-backend/src/routes/workspaces.ts#L18-L29)
- [auth.ts:8-23](file://phoenix-backend/src/lib/auth.ts#L8-L23)

**Section sources**
- [workspaces.ts:18-29](file://phoenix-backend/src/routes/workspaces.ts#L18-L29)

### Workspace Creation
- Endpoint: POST /api/workspaces
- Authorization: Requires authenticated user (Bearer token).
- Behavior:
  - Validates workspace name.
  - Creates workspace with initial credits based on settings.
  - Sets creator as owner and logs welcome credits in ledger.
- Request body:
  - name: string (1–120 characters)
- Response:
  - id, name, owner_id, role: "owner"

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant A as "Auth"
participant V as "Validation"
participant W as "Workspace Model"
participant L as "CreditLedger Model"
C->>R : POST /api/workspaces {name}
R->>A : requireUser()
A-->>R : Current User
R->>V : parseBody(WorkspaceIn)
V-->>R : Parsed name
R->>W : Create workspace with owner and credits
R->>L : Create welcome credits entry
R-->>C : 201 Created with workspace object
```

**Diagram sources**
- [workspaces.ts:31-42](file://phoenix-backend/src/routes/workspaces.ts#L31-L42)
- [schemas.ts:15-15](file://phoenix-backend/src/lib/schemas.ts#L15-L15)
- [config.ts:11-11](file://phoenix-backend/src/config.ts#L11-L11)

**Section sources**
- [workspaces.ts:31-42](file://phoenix-backend/src/routes/workspaces.ts#L31-L42)
- [schemas.ts:15-15](file://phoenix-backend/src/lib/schemas.ts#L15-L15)
- [config.ts:11-11](file://phoenix-backend/src/config.ts#L11-L11)

### Workspace Retrieval
- Endpoint: GET /api/workspaces/:id
- Authorization: Requires authenticated user who is a member of the workspace.
- Behavior:
  - Validates workspace ID.
  - Checks membership; returns 404 if not a member.
  - Returns workspace details with current user’s role.
- Response fields:
  - id, name, owner_id, role

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant A as "Auth"
participant W as "Workspace Model"
C->>R : GET /api/workspaces/ : id
R->>A : requireUser()
A-->>R : Current User
R->>A : requireMember(id, user)
A-->>R : Member info or 404
R->>W : Find workspace by ID
R-->>C : Workspace object with role
```

**Diagram sources**
- [workspaces.ts:44-54](file://phoenix-backend/src/routes/workspaces.ts#L44-L54)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

**Section sources**
- [workspaces.ts:44-54](file://phoenix-backend/src/routes/workspaces.ts#L44-L54)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

### Member Listing
- Endpoint: GET /api/workspaces/:id/members
- Authorization: Requires authenticated user who is a member of the workspace.
- Behavior:
  - Validates workspace ID and membership.
  - Retrieves all members with user details and roles.
- Response fields per member:
  - user_id, email, full_name, role

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant A as "Auth"
participant M as "WorkspaceMember Model"
C->>R : GET /api/workspaces/ : id/members
R->>A : requireUser()
A-->>R : Current User
R->>A : requireMember(id, user)
A-->>R : Member info or 404
R->>M : Find members and populate user
R-->>C : Array of member objects
```

**Diagram sources**
- [workspaces.ts:56-75](file://phoenix-backend/src/routes/workspaces.ts#L56-L75)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

**Section sources**
- [workspaces.ts:56-75](file://phoenix-backend/src/routes/workspaces.ts#L56-L75)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

### Member Invitation
- Endpoint: POST /api/workspaces/:id/members
- Authorization: Requires authenticated user who is owner or admin.
- Behavior:
  - Validates workspace ID and actor role.
  - Validates request body (email and role).
  - Prevents assigning "owner" role to another user.
  - Looks up target user by email; returns 404 if not found.
  - Creates membership; handles duplicate key conflicts (returns 409).
- Request body:
  - email: string (3–255 characters)
  - role: one of "owner", "admin", "member" (default "member")
- Response:
  - user_id, email, full_name, role

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant A as "Auth"
participant V as "Validation"
participant U as "User Model"
participant M as "WorkspaceMember Model"
C->>R : POST /api/workspaces/ : id/members {email, role}
R->>A : requireUser()
A-->>R : Current User
R->>A : requireAdmin(id, user)
A-->>R : Admin info or 403
R->>V : parseBody(MemberIn)
V-->>R : Parsed email and role
R->>U : Find user by email
U-->>R : User or 404
R->>M : Create membership
M-->>R : Success or Duplicate Key
R-->>C : 201 Created with member object
```

**Diagram sources**
- [workspaces.ts:77-102](file://phoenix-backend/src/routes/workspaces.ts#L77-L102)
- [schemas.ts:17-20](file://phoenix-backend/src/lib/schemas.ts#L17-L20)
- [http.ts:38-40](file://phoenix-backend/src/lib/http.ts#L38-L40)

**Section sources**
- [workspaces.ts:77-102](file://phoenix-backend/src/routes/workspaces.ts#L77-L102)
- [schemas.ts:17-20](file://phoenix-backend/src/lib/schemas.ts#L17-L20)
- [http.ts:38-40](file://phoenix-backend/src/lib/http.ts#L38-L40)

### Credit Balance Checking
- Endpoint: GET /api/workspaces/:id/credits
- Authorization: Requires authenticated user who is a member of the workspace.
- Behavior:
  - Validates workspace ID and membership.
  - Returns workspace ID and current credits balance.
- Response fields:
  - workspace_id, balance

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant A as "Auth"
participant W as "Workspace Model"
C->>R : GET /api/workspaces/ : id/credits
R->>A : requireUser()
A-->>R : Current User
R->>A : requireMember(id, user)
A-->>R : Member info or 404
R->>W : Find workspace credits
R-->>C : {workspace_id, balance}
```

**Diagram sources**
- [workspaces.ts:104-113](file://phoenix-backend/src/routes/workspaces.ts#L104-L113)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

**Section sources**
- [workspaces.ts:104-113](file://phoenix-backend/src/routes/workspaces.ts#L104-L113)
- [auth.ts:29-34](file://phoenix-backend/src/lib/auth.ts#L29-L34)

### Credit Top-Up
- Endpoint: POST /api/workspaces/:id/credits/topup
- Authorization: Requires authenticated user who is the workspace owner.
- Behavior:
  - Validates workspace ID and owner role.
  - Validates amount (positive integer, max 1000).
  - Increments workspace credits and records ledger entry.
- Request body:
  - amount: positive integer, maximum 1000
- Response:
  - workspace_id, balance

```mermaid
sequenceDiagram
participant C as "Client"
participant R as "Router"
participant A as "Auth"
participant V as "Validation"
participant W as "Workspace Model"
participant L as "CreditLedger Model"
C->>R : POST /api/workspaces/ : id/credits/topup {amount}
R->>A : requireUser()
A-->>R : Current User
R->>A : requireOwner(id, user)
A-->>R : Owner info or 403
R->>V : parseBody(TopUpIn)
V-->>R : Parsed amount
R->>W : Update credits incrementally
R->>L : Create ledger entry
R-->>C : {workspace_id, balance}
```

**Diagram sources**
- [workspaces.ts:115-127](file://phoenix-backend/src/routes/workspaces.ts#L115-L127)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)

**Section sources**
- [workspaces.ts:115-127](file://phoenix-backend/src/routes/workspaces.ts#L115-L127)
- [schemas.ts:22-22](file://phoenix-backend/src/lib/schemas.ts#L22-L22)

## Dependency Analysis
The workspace management endpoints depend on:
- Authentication middleware for user identity and role enforcement
- Zod schemas for input validation
- Mongoose models for data persistence
- Configuration for environment-driven defaults (e.g., welcome credits)
- HTTP helpers for consistent error handling and ID parsing

```mermaid
graph LR
Routes["routes/workspaces.ts"] --> Auth["lib/auth.ts"]
Routes --> Schemas["lib/schemas.ts"]
Routes --> Models["models/*"]
Routes --> Http["lib/http.ts"]
Routes --> Config["config.ts"]
```

**Diagram sources**
- [workspaces.ts:1-128](file://phoenix-backend/src/routes/workspaces.ts#L1-L128)
- [auth.ts:1-58](file://phoenix-backend/src/lib/auth.ts#L1-L58)
- [schemas.ts:1-41](file://phoenix-backend/src/lib/schemas.ts#L1-L41)
- [http.ts:1-81](file://phoenix-backend/src/lib/http.ts#L1-L81)
- [config.ts:1-41](file://phoenix-backend/src/config.ts#L1-L41)

**Section sources**
- [workspaces.ts:1-128](file://phoenix-backend/src/routes/workspaces.ts#L1-L128)

## Performance Considerations
- Database queries are lean and targeted:
  - Workspace listing uses indexed membership lookups and sorts by ID.
  - Member listing populates only necessary user fields.
  - Credits balance reads only the credits field.
- Indexing:
  - WorkspaceMember has a unique index on workspace and user to prevent duplicates efficiently.
  - CreditLedger indexes workspace and idempotency key for fast lookups and deduplication.
- Validation overhead is minimal due to Zod’s efficient parsing.
- Avoid unnecessary population; only populate when returning member details.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- 401 Not authenticated: Ensure Bearer token is present and valid.
- 401 Invalid or expired token: Refresh or regenerate token.
- 403 Admin/Owner role required: Verify user role in workspace.
- 404 Workspace not found: Either workspace does not exist or user is not a member.
- 409 Conflict: Attempting to invite an existing member; check membership first.
- 422 Validation error: Inspect request body against schemas (name length, role enum, amount range).
- 400 Malformed JSON: Ensure proper JSON structure and encoding.

**Section sources**
- [http.ts:42-81](file://phoenix-backend/src/lib/http.ts#L42-L81)
- [workspaces.ts:77-102](file://phoenix-backend/src/routes/workspaces.ts#L77-L102)

## Conclusion
The workspace management API provides robust multi-tenant capabilities with clear role-based access control, validated inputs, and consistent error handling. It supports essential operations for managing workspaces, members, and credits, enabling secure and predictable workflows for team collaboration and resource allocation.

[No sources needed since this section summarizes without analyzing specific files]