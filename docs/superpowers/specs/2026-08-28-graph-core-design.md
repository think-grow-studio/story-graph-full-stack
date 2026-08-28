# Graph Core Design

**Status:** Approved design for implementation planning
**Date:** 2026-08-28
**Parent architecture:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## 1. Goal

Add the first graph-domain backend slice on top of the existing authenticated Workspace and Story foundation.

This slice establishes durable canonical graph data and Board presentation state so the next slice can build the React Flow editor without inventing temporary persistence models.

The slice intentionally excludes the graph editor UI, Zustand working state, autosave queue, undo/redo, Scope state, collaboration, WebSocket, CRDT, and AI features.

## 2. Core invariants

1. `Story` owns canonical `Node` and `Edge` data.
2. `Board` is a View. It owns presentation state only.
3. `Node` and `Edge` names, descriptions, icons, properties, and versions never live in Board presentation tables.
4. Every Edge is directed from `sourceNodeId` to `targetNodeId`.
5. Multiple Edges between the same source and target are allowed. No `(sourceNodeId, targetNodeId)` uniqueness constraint is permitted.
6. An Edge may connect only Nodes belonging to the same Story as the Edge.
7. A Board may reference only Nodes and Edges belonging to its own Story.
8. Canonical Node/Edge updates use optimistic locking through an integer `version`.
9. Stale canonical updates return HTTP `409 Conflict` and do not overwrite newer state.
10. Workspace authorization remains backend-enforced through capability checks in application use-cases.

## 3. Domain model

```text
Workspace
 └─ Story
     ├─ Node
     ├─ Edge
     └─ Board
         ├─ BoardNode
         └─ BoardEdge
```

### Node

Canonical entity representing anything meaningful in a story world.

Fields:

```text
id           text/uuid-shaped client-generated id
storyId      FK → Story
name         string, 1..200 after trim
description  string, max 10,000
iconKey      nullable string, max 200
properties   JSONB object
version      positive integer, starts at 1
createdAt    timestamp
updatedAt    timestamp
```

The model has no hard-coded entity type enum. User-defined classification can be added later without changing the canonical Node identity.

### Edge

Canonical directed relationship between two Nodes.

Fields:

```text
id             text/uuid-shaped client-generated id
storyId        FK → Story
sourceNodeId   FK → Node
targetNodeId   FK → Node
name           string, 1..200 after trim
description    string, max 10,000
iconKey        nullable string, max 200
properties     JSONB object
version        positive integer, starts at 1
createdAt      timestamp
updatedAt      timestamp
```

The database must not add uniqueness across source/target because a story may have multiple simultaneous relationships between the same two Nodes.

Cross-Story Node references are rejected by the application transaction even if individual foreign keys are structurally valid.

### Board

A named visual view over Story graph data.

Fields:

```text
id           text/uuid-shaped server-generated id
storyId      FK → Story
name         string, 1..200 after trim
description  string, max 10,000
revision     non-negative integer, starts at 0
createdAt    timestamp
updatedAt    timestamp
```

`revision` is a coarse Board snapshot generation marker. It is not the optimistic lock for canonical Node/Edge data.

### BoardNode

Presentation state for one canonical Node on one Board.

Fields:

```text
boardId     FK → Board
nodeId      FK → Node
x           finite number
y           finite number
width       nullable positive number
height      nullable positive number
zIndex      integer
style       JSONB object
createdAt   timestamp
updatedAt   timestamp
```

Primary/unique identity is `(boardId, nodeId)`.

### BoardEdge

Presentation state for one canonical Edge on one Board.

Fields:

```text
boardId           FK → Board
edgeId            FK → Edge
style             JSONB object
labelPresentation JSONB object
createdAt         timestamp
updatedAt         timestamp
```

Primary/unique identity is `(boardId, edgeId)`.

## 4. Deletion semantics

Deletion semantics must preserve the Story/Board ownership model and avoid orphan presentation rows.

- Deleting a Story cascades to Nodes, Edges, Boards, BoardNodes, and BoardEdges.
- Deleting a Node cascades to Edges where it is source or target and removes all BoardNode rows for that Node.
- Edge deletion removes all BoardEdge rows for that Edge.
- Board deletion removes only BoardNode and BoardEdge presentation rows. Canonical Nodes and Edges remain.
- Removing a Node from a Board deletes only the BoardNode row. It does not delete the canonical Node.
- Removing an Edge from a Board deletes only the BoardEdge row. It does not delete the canonical Edge.

Canonical entity deletion endpoints are intentionally excluded from this slice. They can be added when the editor UX defines destructive-story-data semantics separately from “remove from this Board”.

## 5. Authorization

Extend Workspace capabilities with:

```text
graph:read
graph:update
```

V1 mapping:

```text
owner/admin → graph:read, graph:update
member      → graph:read
```

Application use-cases resolve the owning Story/Workspace before performing graph operations.

Cross-Workspace resource access must not leak existence. Resource lookups that reveal a Story/Board/Node/Edge outside the supplied Workspace resolve as `404` before a capability error would expose information.

## 6. Repository and transaction boundaries

Add a `graph` backend module with domain/application/infrastructure separation.

```text
src/backend/modules/graph/
├─ domain/
├─ application/
└─ infrastructure/
```

Application code depends on repository/transaction ports, never Drizzle directly.

The infrastructure layer implements PostgreSQL/Drizzle repositories and transactions.

Transactions are mandatory for operations that must create or validate multiple records atomically:

- create Node from Board → create canonical Node + BoardNode
- create Edge from Board → validate source/target/Board Story identity + create canonical Edge + BoardEdge
- optimistic Node/Edge update → compare expected version + update exactly one row

## 7. API contracts

All business endpoints remain under `/api/v1`. Shared request/response Zod schemas live under `src/contracts/graph` or an equivalent focused graph contract module.

### Create Board

```http
POST /api/v1/stories/{storyId}/boards
```

Request:

```json
{
  "workspaceId": "...",
  "name": "Main Board",
  "description": ""
}
```

Returns the created Board.

### Board snapshot

```http
GET /api/v1/boards/{boardId}/snapshot?workspaceId=...
```

Returns one editor bootstrap payload:

```json
{
  "story": { "id": "...", "name": "..." },
  "board": {
    "id": "...",
    "storyId": "...",
    "name": "...",
    "description": "...",
    "revision": 0,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "nodes": [],
  "edges": [],
  "boardNodes": [],
  "boardEdges": []
}
```

The snapshot is read-consistent within one database transaction/query boundary so a client does not hydrate from unrelated moments in time.

### Create Node from Board

```http
POST /api/v1/boards/{boardId}/nodes
```

Request:

```json
{
  "workspaceId": "...",
  "id": "client-generated-uuid",
  "name": "Ari",
  "description": "",
  "iconKey": null,
  "properties": {},
  "position": { "x": 120, "y": 80 }
}
```

The use-case atomically creates the canonical Node and BoardNode presentation row.

### Update canonical Node

```http
PATCH /api/v1/nodes/{nodeId}
```

Request:

```json
{
  "workspaceId": "...",
  "version": 3,
  "name": "Ari Voss",
  "description": "...",
  "iconKey": "character",
  "properties": { "age": 29 }
}
```

Only supplied mutable fields change. A successful update increments `version` from 3 to 4. If current version is not 3, return `409`.

### Update BoardNode presentation

```http
PATCH /api/v1/boards/{boardId}/nodes/{nodeId}
```

Request may update `x`, `y`, `width`, `height`, `zIndex`, or `style`.

This operation does not mutate canonical Node fields or version.

### Remove Node from Board

```http
DELETE /api/v1/boards/{boardId}/nodes/{nodeId}?workspaceId=...
```

Deletes BoardNode only.

### Create Edge from Board

```http
POST /api/v1/boards/{boardId}/edges
```

Request:

```json
{
  "workspaceId": "...",
  "id": "client-generated-uuid",
  "sourceNodeId": "...",
  "targetNodeId": "...",
  "name": "trusts",
  "description": "",
  "iconKey": null,
  "properties": {}
}
```

The use-case validates that Board, source Node, and target Node all belong to the same Story, then atomically creates canonical Edge + BoardEdge.

The same source/target pair may be submitted repeatedly with different Edge IDs.

### Update canonical Edge

```http
PATCH /api/v1/edges/{edgeId}
```

Uses the same expected-version optimistic locking semantics as Node updates. Source and target rewiring is excluded from this slice; mutable fields are name, description, iconKey, and properties only.

### Remove Edge from Board

```http
DELETE /api/v1/boards/{boardId}/edges/{edgeId}?workspaceId=...
```

Deletes BoardEdge only.

## 8. Validation and error semantics

Use shared Zod contracts for HTTP validation.

- malformed ids/invalid strings/non-finite coordinates → `400 VALIDATION_ERROR`
- missing authentication → `401 UNAUTHORIZED`
- insufficient capability on a resource inside the caller's Workspace → `403 FORBIDDEN`
- resource outside supplied Workspace or missing resource → `404 NOT_FOUND`
- stale Node/Edge version → `409 CONFLICT`

`properties`, `style`, and `labelPresentation` are JSON objects, not arbitrary primitives or arrays.

Database constraint errors are not returned directly to clients.

## 9. Optimistic locking

Node and Edge canonical updates use compare-and-swap semantics in SQL:

```text
UPDATE node
SET ..., version = version + 1, updated_at = now()
WHERE id = :id AND version = :expectedVersion
RETURNING ...
```

If the resource was resolved first but the conditional update returns no row, the use-case returns `409 CONFLICT`.

A blind read-then-update without the version predicate is not acceptable.

Board presentation writes are last-write-wins in this slice. Board `revision` may increment when Board presentation membership/state changes so snapshot consumers can observe coarse changes, but no `409` policy is attached to Board revision yet.

## 10. Snapshot consistency

`GET /boards/{boardId}/snapshot` returns:

1. owning Story summary,
2. Board metadata,
3. every canonical Node represented by that Board,
4. every canonical Edge represented by that Board,
5. BoardNode presentation rows,
6. BoardEdge presentation rows.

A canonical Story Node that has no BoardNode row is not included in that Board snapshot. A canonical Story Edge that has no BoardEdge row is not included either.

This keeps the snapshot equal to the Board View rather than every entity in the Story.

## 11. OpenAPI

The existing Zod-driven OpenAPI document remains the only API documentation source.

Every new graph endpoint and `400/401/403/404/409` response used by the endpoint is registered in the generated OpenAPI document. Swagger UI continues to consume `/api/openapi.json`; no hand-written duplicate schema is added.

## 12. Testing

### Unit tests

Cover graph application invariants without a database where possible:

- capability requested for read/update flows
- Node/Edge version conflict mapping
- cross-Story resources rejected before mutation
- remove-from-Board does not request canonical deletion

### PostgreSQL repository/integration tests

Use real PostgreSQL and committed Drizzle migrations to verify:

- JSONB round-trip for properties/style
- Board + Node + BoardNode atomic creation
- same source/target supports two or more directed Edges
- cross-Story Edge creation rejected atomically
- optimistic Node update increments version
- stale Node update returns conflict and preserves newer data
- optimistic Edge update behaves identically
- FK/cascade behavior matches Section 4
- Board removal preserves canonical Node/Edge
- snapshot contains only entities represented on that Board

### API integration tests

Verify request validation, auth, capability enforcement, cross-Workspace `404`, and `409` semantics.

### E2E

No React Flow editor is added in this slice. Add one narrow authenticated browser/API workflow that proves:

```text
create Story
→ create Board
→ create Node through Board
→ fetch snapshot
→ reload/request again
→ Node and placement still exist
```

This preserves the project's `edit/create → saved → reload → verify` persistence pattern before the editor UI is introduced.

## 13. Non-goals

This slice does not implement:

- React Flow UI
- Zustand graph working state
- autosave/save queue
- undo/redo commands
- canonical Node/Edge deletion UX/API
- source/target rewiring
- Scope/NodeState/EdgeState
- WebSocket or collaboration
- CRDT/Yjs
- event sourcing
- Redis or queue infrastructure
- AI reasoning

## 14. Completion criteria

The slice is complete when:

1. Drizzle migrations create the graph tables and constraints described here.
2. Application code does not import Drizzle/database infrastructure.
3. Graph capabilities are enforced through the Workspace access abstraction.
4. All specified APIs are represented by shared Zod contracts and OpenAPI.
5. Node/Edge optimistic locking returns deterministic `409` on stale writes.
6. Directed multi-edge behavior is proven against PostgreSQL.
7. Board snapshot is a single editor bootstrap payload containing canonical + presentation state.
8. Full repository CI passes: architecture checks, lint, typecheck, unit tests, PostgreSQL integration tests, production build, clean-tree check, and Chromium E2E.
