# Graph Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the durable Graph Core backend for Board, Node, Edge, BoardNode, BoardEdge, optimistic locking, snapshot loading, authorization, contracts, OpenAPI, and persistence verification.

**Architecture:** Extend the existing Next.js modular monolith with a `backend/modules/graph` module. Route Handlers remain composition-only; application use-cases depend on `StoryRepository`, `WorkspaceAccessService`, and graph repository ports; Drizzle/PostgreSQL implements persistence and transaction boundaries. Canonical Node/Edge data belongs to Story, while BoardNode/BoardEdge contain presentation state only.

**Tech Stack:** Node.js 24, pnpm 11.21, Next.js 16.3.3, TypeScript 5.9, PostgreSQL 16, Drizzle ORM 0.45.2, Zod 4.4.3, Vitest, Playwright, Zod-to-OpenAPI.

**Spec:** `docs/superpowers/specs/2026-08-28-graph-core-design.md`

## Global Constraints

- Frontend↔Backend application data crosses HTTP `/api/v1` only.
- `frontend` must not import backend, Drizzle, or database code.
- Backend application code must not import infrastructure, Drizzle, `pg`, or database schema modules.
- Board = View; Node/Edge canonical data belongs to Story.
- Multiple directed Edges between the same source and target are allowed.
- Node/Edge canonical updates use integer optimistic locking and stale writes return `409 CONFLICT`.
- Cross-Workspace resource access resolves as `404` before capability checks leak existence.
- Graph JSON fields accept objects only, never arrays or primitives.
- No React Flow UI, Zustand editor state, autosave queue, undo/redo, Scope state, collaboration, Redis, queue, or AI work in this slice.
- All schema changes are committed Drizzle migrations; production never relies on schema push.

---

## File map

### Database and infrastructure
- Create `src/backend/infrastructure/database/schema/graph.schema.ts`: graph tables, indexes, composite foreign keys, cascades.
- Modify `src/backend/infrastructure/database/schema/index.ts`: export graph schema.
- Generate `drizzle/0002_graph-core.sql` and metadata using `pnpm db:generate`.
- Create `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`: all graph reads/writes and required PostgreSQL transactions.

### Domain/application
- Create `src/backend/modules/graph/domain/graph.ts`: `Board`, `GraphNode`, `GraphEdge`, `BoardNode`, `BoardEdge`, `BoardSnapshot`.
- Create `src/backend/modules/graph/domain/graph.repository.ts`: persistence port used by application code.
- Create focused application use-cases under `src/backend/modules/graph/application/*` for board creation/snapshot, node create/update/placement/remove, edge create/update/remove.
- Modify `src/backend/common/errors/application-error.ts`: add `CONFLICT`.
- Modify `src/backend/modules/workspace/domain/workspace-access.service.ts`: add `graph:read`, `graph:update`.
- Modify `src/backend/modules/workspace/domain/workspace-capability.policy.ts`: owner/admin full graph access, member graph read only.

### Contracts/routes/docs
- Create `src/contracts/graph/graph.contract.ts`: all graph Zod request/response schemas.
- Create Route Handlers under `src/app/api/v1/stories/[storyId]/boards`, `src/app/api/v1/boards/[boardId]`, `src/app/api/v1/nodes/[nodeId]`, and `src/app/api/v1/edges/[edgeId]`.
- Modify `src/backend/infrastructure/openapi/openapi-document.ts`: register graph schemas/endpoints and `409` responses.

### Tests
- Add graph application unit tests near use-cases.
- Create `tests/integration/graph/graph-repository.integration.ts` for DB constraints/transactions/cascades/locking/snapshot.
- Create `tests/integration/graph/graph-api.integration.ts` for HTTP auth/validation/404/403/409 behavior.
- Extend `tests/e2e/auth-story.spec.ts` with Story → Board → Node → Snapshot persistence workflow.

---

### Task 1: Graph capability and conflict foundations

**Files:**
- Modify: `src/backend/common/errors/application-error.ts`
- Modify: `src/backend/modules/workspace/domain/workspace-access.service.ts`
- Modify: `src/backend/modules/workspace/domain/workspace-capability.policy.ts`
- Modify: `src/backend/modules/workspace/infrastructure/drizzle-workspace-access.service.test.ts`

**Interfaces:**
- Produces `ApplicationErrorCode` including `"CONFLICT"`.
- Produces `WorkspaceCapability` including `"graph:read" | "graph:update"`.
- Keeps `WorkspaceAccessService.requireCapability(input)` signature unchanged.

- [ ] **Step 1: Write failing capability tests**

Add assertions equivalent to:

```ts
expect(workspaceRoleHasCapability("owner", "graph:read")).toBe(true);
expect(workspaceRoleHasCapability("admin", "graph:update")).toBe(true);
expect(workspaceRoleHasCapability("member", "graph:read")).toBe(true);
expect(workspaceRoleHasCapability("member", "graph:update")).toBe(false);
```

Also add a compile-level use of `new ApplicationError("CONFLICT", 409)` in the closest error/use-case test.

- [ ] **Step 2: Run targeted tests and verify RED**

Run:

```bash
pnpm vitest run src/backend/modules/workspace/infrastructure/drizzle-workspace-access.service.test.ts
pnpm typecheck
```

Expected: capability/type checks fail because graph capabilities and `CONFLICT` are not declared.

- [ ] **Step 3: Implement capability/error types**

Use these exact capability rules:

```ts
export type WorkspaceCapability =
  | "story:read"
  | "story:create"
  | "story:update"
  | "story:delete"
  | "graph:read"
  | "graph:update";
```

Owner/admin capabilities contain all Story capabilities plus both graph capabilities. Member capabilities are exactly `story:read` and `graph:read`.

Extend error code union with `"CONFLICT"`.

- [ ] **Step 4: Run targeted tests and typecheck**

Run:

```bash
pnpm vitest run src/backend/modules/workspace/infrastructure/drizzle-workspace-access.service.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/common/errors/application-error.ts src/backend/modules/workspace
git commit -m "feat: add graph capabilities and conflict error"
```

---

### Task 2: Graph domain model and PostgreSQL schema

**Files:**
- Create: `src/backend/modules/graph/domain/graph.ts`
- Create: `src/backend/modules/graph/domain/graph.repository.ts`
- Create: `src/backend/infrastructure/database/schema/graph.schema.ts`
- Modify: `src/backend/infrastructure/database/schema/index.ts`
- Create via generator: `drizzle/0002_graph-core.sql`
- Modify via generator: `drizzle/meta/_journal.json`
- Create via generator: next snapshot under `drizzle/meta/`
- Test: `tests/integration/graph/graph-repository.integration.ts`

**Interfaces:**

Define domain types:

```ts
export type JsonObject = Record<string, unknown>;

export interface Board {
  id: string;
  storyId: string;
  name: string;
  description: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphNode {
  id: string;
  storyId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  storyId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardNode {
  boardId: string;
  nodeId: string;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number;
  style: JsonObject;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardEdge {
  boardId: string;
  edgeId: string;
  style: JsonObject;
  labelPresentation: JsonObject;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardSnapshot {
  board: Board;
  nodes: GraphNode[];
  edges: GraphEdge[];
  boardNodes: BoardNode[];
  boardEdges: BoardEdge[];
}
```

Define `GraphRepository` with exact operations later application tasks consume:

```ts
export interface GraphRepository {
  createBoard(input: { storyId: string; name: string; description: string }): Promise<Board>;
  findBoard(id: string): Promise<Board | null>;
  findNode(id: string): Promise<GraphNode | null>;
  findEdge(id: string): Promise<GraphEdge | null>;
  getBoardSnapshot(boardId: string): Promise<BoardSnapshot | null>;
  createNodeOnBoard(input: {
    boardId: string;
    node: GraphNode;
    placement: Pick<BoardNode, "x" | "y" | "width" | "height" | "zIndex" | "style">;
  }): Promise<{ node: GraphNode; boardNode: BoardNode }>;
  updateNode(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
  }): Promise<GraphNode | null>;
  updateBoardNode(input: {
    boardId: string;
    nodeId: string;
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    style?: JsonObject;
  }): Promise<BoardNode | null>;
  removeNodeFromBoard(boardId: string, nodeId: string): Promise<boolean>;
  createEdgeOnBoard(input: {
    boardId: string;
    edge: GraphEdge;
  }): Promise<{ edge: GraphEdge; boardEdge: BoardEdge }>;
  updateEdge(input: {
    id: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
  }): Promise<GraphEdge | null>;
  removeEdgeFromBoard(boardId: string, edgeId: string): Promise<boolean>;
}
```

- [ ] **Step 1: Write PostgreSQL constraint tests first**

Create tests that insert two Stories and prove:

```ts
// allowed: same source/target pair twice with different edge ids
expect(await createEdge("edge-1", nodeA.id, nodeB.id)).toBeDefined();
expect(await createEdge("edge-2", nodeA.id, nodeB.id)).toBeDefined();

// rejected: edge storyId does not match source/target story
await expect(insertCrossStoryEdge()).rejects.toThrow();

// rejected: board-node / board-edge cross-story linkage
await expect(insertCrossStoryBoardNode()).rejects.toThrow();
```

- [ ] **Step 2: Run integration test and verify RED**

Run:

```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
```

Expected: FAIL because graph schema/tables do not exist.

- [ ] **Step 3: Implement schema with DB-enforced Story identity**

Use five tables: `graph_node`, `graph_edge`, `board`, `board_node`, `board_edge`.

Important integrity detail: `board_node` and `board_edge` include an internal `story_id` column even though it is not exposed in API/domain response. It exists solely so PostgreSQL can enforce same-Story composite foreign keys.

Required composite uniqueness/FKs:

```text
graph_node UNIQUE(id, story_id)
graph_edge UNIQUE(id, story_id)
board      UNIQUE(id, story_id)

graph_edge(source_node_id, story_id) → graph_node(id, story_id) ON DELETE CASCADE
graph_edge(target_node_id, story_id) → graph_node(id, story_id) ON DELETE CASCADE
board_node(board_id, story_id)        → board(id, story_id) ON DELETE CASCADE
board_node(node_id, story_id)         → graph_node(id, story_id) ON DELETE CASCADE
board_edge(board_id, story_id)        → board(id, story_id) ON DELETE CASCADE
board_edge(edge_id, story_id)         → graph_edge(id, story_id) ON DELETE CASCADE
```

Do not create a source/target uniqueness constraint.

Defaults:

```text
Node.version = 1
Edge.version = 1
Board.revision = 0
properties/style/labelPresentation = '{}'::jsonb
BoardNode.zIndex = 0
```

- [ ] **Step 4: Generate and inspect migration**

Run:

```bash
pnpm db:generate
pnpm db:check
```

Expected: a new `0002_*` migration with all five tables, composite unique constraints/FKs, indexes on `story_id`, board membership keys, source/target IDs, and no source-target unique index.

- [ ] **Step 5: Apply migration and run constraint tests**

Run:

```bash
pnpm db:migrate
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
```

Expected: PASS for schema-level invariants.

- [ ] **Step 6: Commit**

```bash
git add src/backend/modules/graph/domain src/backend/infrastructure/database/schema drizzle tests/integration/graph/graph-repository.integration.ts
git commit -m "feat: add graph core schema and domain"
```

---

### Task 3: Drizzle graph repository and transactional invariants

**Files:**
- Create: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Expand: `tests/integration/graph/graph-repository.integration.ts`

**Interfaces:** Implements the `GraphRepository` interface from Task 2.

- [ ] **Step 1: Add failing repository behavior tests**

Cover:

```text
createBoard persists revision 0
createNodeOnBoard creates Node + BoardNode atomically and increments Board revision 0→1
updateBoardNode persists placement and increments Board revision by exactly 1
removeNodeFromBoard removes BoardNode only and increments revision by exactly 1
createEdgeOnBoard creates Edge + BoardEdge atomically and increments revision
removeEdgeFromBoard preserves canonical Edge and increments revision
getBoardSnapshot returns represented entities only
Node optimistic update 1→2
stale Node update returns null and preserves version 2 data
Edge optimistic update behaves the same
canonical Node/Edge update does not increment Board revision
```

For atomicity, intentionally use a cross-Story node/edge input that violates a composite FK and assert no canonical half-record survives after rejection.

- [ ] **Step 2: Run repository integration tests and verify RED**

Run:

```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
```

Expected: FAIL because repository implementation is missing.

- [ ] **Step 3: Implement `DrizzleGraphRepository`**

Use `db.transaction(async (tx) => ...)` for `createNodeOnBoard`, `createEdgeOnBoard`, every Board membership/presentation mutation that must increment revision atomically, and snapshot reads.

Optimistic updates must use a SQL predicate equivalent to:

```ts
.where(and(eq(graphNode.id, input.id), eq(graphNode.version, input.expectedVersion)))
.set({
  ...mutableValues,
  version: sql`${graphNode.version} + 1`,
  updatedAt: new Date(),
})
.returning();
```

Do not implement read-then-unconditional-update.

Snapshot query semantics:
- load Board;
- load BoardNode rows for Board;
- load only Nodes referenced by those BoardNode rows;
- load BoardEdge rows for Board;
- load only Edges referenced by those BoardEdge rows;
- return all data from the same transaction callback.

Map internal `storyId` columns in BoardNode/BoardEdge away before returning domain objects.

- [ ] **Step 4: Run repository integration tests**

Run:

```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/modules/graph/infrastructure tests/integration/graph/graph-repository.integration.ts
git commit -m "feat: add transactional graph repository"
```

---

### Task 4: Board application use-cases and snapshot authorization

**Files:**
- Create: `src/backend/modules/graph/application/create-board/create-board.ts`
- Create: `src/backend/modules/graph/application/get-board-snapshot/get-board-snapshot.ts`
- Create: `src/backend/modules/graph/application/board.use-cases.test.ts`

**Interfaces:**

```ts
createBoard(
  input: { actorId: string; workspaceId: string; storyId: string; name: string; description: string },
  deps: { stories: StoryRepository; graph: GraphRepository; access: WorkspaceAccessService },
): Promise<Board>

getBoardSnapshot(
  input: { actorId: string; workspaceId: string; boardId: string },
  deps: { stories: StoryRepository; graph: GraphRepository; access: WorkspaceAccessService },
): Promise<{ story: Pick<Story, "id" | "name">; snapshot: BoardSnapshot }>
```

- [ ] **Step 1: Write failing unit tests**

Create Board behavior:
1. `StoryRepository.findById(storyId)` first.
2. If missing or `story.workspaceId !== workspaceId`, throw `NOT_FOUND 404`.
3. Then require `graph:update` for that Workspace.
4. Then create Board.

Snapshot behavior:
1. Load Board.
2. Load owning Story.
3. If either missing or Story Workspace differs from supplied Workspace, return `404` before capability check.
4. Require `graph:read`.
5. Fetch snapshot and return Story summary + snapshot.

- [ ] **Step 2: Run unit test and verify RED**

```bash
pnpm vitest run src/backend/modules/graph/application/board.use-cases.test.ts
```

Expected: FAIL because use-cases do not exist.

- [ ] **Step 3: Implement minimal use-cases**

Use only repository/access ports. Do not import Drizzle/database/infrastructure.

- [ ] **Step 4: Run unit test and boundary checks**

```bash
pnpm vitest run src/backend/modules/graph/application/board.use-cases.test.ts
pnpm check:boundaries
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/modules/graph/application
git commit -m "feat: add board application use cases"
```

---

### Task 5: Node application use-cases and optimistic conflict mapping

**Files:**
- Create: `src/backend/modules/graph/application/create-node-on-board/create-node-on-board.ts`
- Create: `src/backend/modules/graph/application/update-node/update-node.ts`
- Create: `src/backend/modules/graph/application/update-board-node/update-board-node.ts`
- Create: `src/backend/modules/graph/application/remove-node-from-board/remove-node-from-board.ts`
- Create: `src/backend/modules/graph/application/node.use-cases.test.ts`

**Interfaces:**

```ts
createNodeOnBoard(input: {
  actorId: string; workspaceId: string; boardId: string; id: string;
  name: string; description: string; iconKey: string | null; properties: JsonObject;
  x: number; y: number; width: number | null; height: number | null; zIndex: number; style: JsonObject;
}, deps): Promise<{ node: GraphNode; boardNode: BoardNode }>

updateNode(input: {
  actorId: string; workspaceId: string; nodeId: string; version: number;
  name?: string; description?: string; iconKey?: string | null; properties?: JsonObject;
}, deps): Promise<GraphNode>

updateBoardNode(input: {
  actorId: string; workspaceId: string; boardId: string; nodeId: string;
  x?: number; y?: number; width?: number | null; height?: number | null; zIndex?: number; style?: JsonObject;
}, deps): Promise<BoardNode>

removeNodeFromBoard(input: {
  actorId: string; workspaceId: string; boardId: string; nodeId: string;
}, deps): Promise<void>
```

Each deps object contains `stories`, `graph`, and `access` using the same ports as Task 4.

- [ ] **Step 1: Write failing unit tests**

Verify:
- Board/Node owning Story is resolved before capability check.
- Cross-Workspace addressing becomes `404`.
- Every mutation requires `graph:update`.
- `createNodeOnBoard` creates a canonical Node with `version: 1` and Board placement but does not put canonical fields on BoardNode.
- `updateNode` calls `graph.updateNode` with `expectedVersion`.
- If an existing Node is resolved but `graph.updateNode` returns `null`, throw `new ApplicationError("CONFLICT", 409)`.
- `updateBoardNode` does not call canonical Node update.
- `removeNodeFromBoard` does not call any canonical delete operation.

- [ ] **Step 2: Run unit tests and verify RED**

```bash
pnpm vitest run src/backend/modules/graph/application/node.use-cases.test.ts
```

- [ ] **Step 3: Implement minimal use-cases**

Create canonical Node timestamp/version in application code:

```ts
const now = new Date();
const node: GraphNode = {
  id: input.id,
  storyId: board.storyId,
  name: input.name,
  description: input.description,
  iconKey: input.iconKey,
  properties: input.properties,
  version: 1,
  createdAt: now,
  updatedAt: now,
};
```

Repository transaction enforces final atomicity and DB constraints.

- [ ] **Step 4: Run unit and boundary tests**

```bash
pnpm vitest run src/backend/modules/graph/application/node.use-cases.test.ts
pnpm check:boundaries
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/modules/graph/application
git commit -m "feat: add graph node use cases"
```

---

### Task 6: Edge application use-cases and directed multi-edge behavior

**Files:**
- Create: `src/backend/modules/graph/application/create-edge-on-board/create-edge-on-board.ts`
- Create: `src/backend/modules/graph/application/update-edge/update-edge.ts`
- Create: `src/backend/modules/graph/application/remove-edge-from-board/remove-edge-from-board.ts`
- Create: `src/backend/modules/graph/application/edge.use-cases.test.ts`

**Interfaces:**

```ts
createEdgeOnBoard(input: {
  actorId: string; workspaceId: string; boardId: string; id: string;
  sourceNodeId: string; targetNodeId: string;
  name: string; description: string; iconKey: string | null; properties: JsonObject;
}, deps): Promise<{ edge: GraphEdge; boardEdge: BoardEdge }>

updateEdge(input: {
  actorId: string; workspaceId: string; edgeId: string; version: number;
  name?: string; description?: string; iconKey?: string | null; properties?: JsonObject;
}, deps): Promise<GraphEdge>

removeEdgeFromBoard(input: {
  actorId: string; workspaceId: string; boardId: string; edgeId: string;
}, deps): Promise<void>
```

- [ ] **Step 1: Write failing unit tests**

Verify create flow resolves Board + source Node + target Node and rejects with `404` unless all three `storyId` values are equal and belong to supplied Workspace. Require `graph:update` only after resource ownership has been validated.

Verify no application rule rejects duplicate `(sourceNodeId, targetNodeId)` pairs; identity is Edge ID.

Verify stale canonical update maps to `CONFLICT 409` exactly like Node.

Verify remove-from-Board does not delete canonical Edge.

- [ ] **Step 2: Run unit tests and verify RED**

```bash
pnpm vitest run src/backend/modules/graph/application/edge.use-cases.test.ts
```

- [ ] **Step 3: Implement minimal use-cases**

Edge creation uses Board Story as canonical `storyId`, keeps source/target direction exactly as submitted, sets `version: 1`, and delegates atomic create to repository.

- [ ] **Step 4: Run unit, repository integration, and boundary tests**

```bash
pnpm vitest run src/backend/modules/graph/application/edge.use-cases.test.ts
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
pnpm check:boundaries
```

Expected: PASS including two Edges with identical source/target.

- [ ] **Step 5: Commit**

```bash
git add src/backend/modules/graph/application
git commit -m "feat: add graph edge use cases"
```

---

### Task 7: Graph HTTP contracts and Route Handlers

**Files:**
- Create: `src/contracts/graph/graph.contract.ts`
- Create: `src/app/api/v1/stories/[storyId]/boards/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/snapshot/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/nodes/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/nodes/[nodeId]/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/edges/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/edges/[edgeId]/route.ts`
- Create: `src/app/api/v1/nodes/[nodeId]/route.ts`
- Create: `src/app/api/v1/edges/[edgeId]/route.ts`
- Create: `tests/integration/graph/graph-api.integration.ts`

**Interfaces:**

Contract primitives:

```ts
const idSchema = z.string().uuid();
const jsonObjectSchema = z.record(z.string(), z.unknown());
const finiteNumberSchema = z.number().finite();
const positiveNullableNumberSchema = z.number().finite().positive().nullable();
```

Use UUID validation for client-created Node/Edge IDs and generated resource IDs. Workspace/Story/Board/Node/Edge path/query IDs use the same UUID shape once created by this application.

Response schemas serialize dates with `z.iso.datetime()`.

- [ ] **Step 1: Write failing API integration tests**

Cover:
- unauthenticated graph mutation → `401`;
- invalid UUID/coordinate/JSON object → `400 VALIDATION_ERROR`;
- create Board → `201`;
- create Node from Board → `201` with node version 1 and placement;
- snapshot → `200` with Story + Board + canonical/presentation arrays;
- Node PATCH version 1 → version 2;
- repeated stale Node PATCH version 1 → `409 CONFLICT`;
- create two same-pair Edges → both `201` with different IDs;
- Edge stale PATCH → `409`;
- cross-Workspace Board/Node/Edge access → `404`;
- remove Node/Edge from Board → `204` and snapshot membership disappears while canonical row remains in DB.

- [ ] **Step 2: Run API integration tests and verify RED**

```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-api.integration.ts
```

- [ ] **Step 3: Implement Zod contracts**

Required request fields and defaults:

```text
Create Board: workspaceId, name, description=""
Create Node: workspaceId, id UUID, name, description="", iconKey=null, properties={}, position{x,y}, width=null, height=null, zIndex=0, style={}
Update Node: workspaceId, version>=1, at least one of name/description/iconKey/properties
Update BoardNode: workspaceId, at least one of x/y/width/height/zIndex/style
Create Edge: workspaceId, id UUID, sourceNodeId UUID, targetNodeId UUID, name, description="", iconKey=null, properties={}
Update Edge: workspaceId, version>=1, at least one of name/description/iconKey/properties
Delete query: workspaceId
```

`properties`, `style`, and `labelPresentation` must reject arrays/primitives.

- [ ] **Step 4: Implement thin Route Handlers**

Every handler follows the established pattern:

```ts
try {
  const actor = await requireCurrentActor(request.headers, identityDependencies);
  const validated = schema.parse(...);
  const result = await useCase({ actorId: actor.id, ...validated }, dependencies);
  return NextResponse.json(responseSchema.parse(toHttp(result)), { status: 201 });
} catch (error) {
  return routeErrorResponse(error);
}
```

Composition dependencies instantiate `DrizzleStoryRepository`, `DrizzleGraphRepository`, and `DrizzleWorkspaceAccessService` only in Route Handler modules.

- [ ] **Step 5: Run graph API integration tests**

```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-api.integration.ts
```

Expected: PASS.

- [ ] **Step 6: Run architecture/unit checks**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/contracts/graph src/app/api/v1 tests/integration/graph/graph-api.integration.ts
git commit -m "feat: expose graph core API"
```

---

### Task 8: OpenAPI graph registration

**Files:**
- Modify: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify: `src/backend/infrastructure/openapi/openapi-document.test.ts`

**Interfaces:** Existing `buildOpenApiDocument()` remains the single OpenAPI source.

- [ ] **Step 1: Write failing OpenAPI tests**

Assert paths exist for all eight graph route groups and that Node/Edge PATCH operations declare `409` responses.

Example:

```ts
expect(document.paths["/api/v1/boards/{boardId}/snapshot"]?.get).toBeDefined();
expect(document.paths["/api/v1/nodes/{nodeId}"]?.patch?.responses?.["409"]).toBeDefined();
expect(document.paths["/api/v1/edges/{edgeId}"]?.patch?.responses?.["409"]).toBeDefined();
```

- [ ] **Step 2: Run OpenAPI test and verify RED**

```bash
pnpm vitest run src/backend/infrastructure/openapi/openapi-document.test.ts
```

- [ ] **Step 3: Register graph contracts and paths**

Dynamically import `@/contracts/graph/graph.contract`, register named schemas, use the existing session cookie security scheme and `apiErrorResponseSchema`, and document `400/401/403/404/409` exactly where applicable.

- [ ] **Step 4: Run OpenAPI and full unit checks**

```bash
pnpm vitest run src/backend/infrastructure/openapi/openapi-document.test.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/backend/infrastructure/openapi
git commit -m "docs: add graph core OpenAPI paths"
```

---

### Task 9: Persistence E2E and final verification

**Files:**
- Modify: `tests/e2e/auth-story.spec.ts`
- Modify if cleanup support is needed: `tests/e2e/helpers/e2e-auth.ts`
- Update: `docs/superpowers/plans/2026-08-28-graph-core.md` status/checkmarks after implementation only.

**Interfaces:** E2E uses real Better Auth test sessions and real PostgreSQL, without Google network calls.

- [ ] **Step 1: Write the E2E persistence flow**

Add one authenticated workflow using API requests with the test session cookie:

```text
bootstrap personal Workspace
→ POST Story
→ POST Board
→ POST Node on Board at {x:120,y:80}
→ GET Board snapshot and assert Node + BoardNode
→ request snapshot again after page/request reload boundary
→ assert same Node ID, version 1, x=120, y=80
```

Use a UUID generated client-side for the Node request.

- [ ] **Step 2: Run E2E and fix only Graph Core defects**

```bash
pnpm e2e
```

Expected: all existing E2E plus Graph Core flow pass.

- [ ] **Step 3: Run the complete repository gate**

Run in this order:

```bash
pnpm db:check
pnpm check
pnpm test:integration
pnpm build
git diff --exit-code
pnpm e2e
```

Expected:
- architecture/AGENTS checks pass;
- ESLint/typecheck/unit tests pass;
- PostgreSQL integration tests pass;
- production build succeeds;
- build leaves tracked files clean;
- Chromium E2E passes.

- [ ] **Step 4: Inspect final diff against spec**

Verify explicitly:

```text
no React Flow/editor UI introduced
no source-target unique constraint
no Board copies of canonical Node/Edge fields
composite same-Story FKs exist
Node/Edge stale writes are 409
Board revision changes only for BoardNode/BoardEdge membership/presentation changes
remove-from-Board preserves canonical entities
snapshot contains represented entities only
application code has no Drizzle imports
OpenAPI includes graph paths + 409
```

- [ ] **Step 5: Commit final E2E/docs changes**

```bash
git add tests/e2e docs/superpowers/plans/2026-08-28-graph-core.md
git commit -m "test: verify graph core persistence flow"
```

- [ ] **Step 6: Create PR only after fresh full verification**

Create a PR from `feat/graph-core` to `main` summarizing schema invariants, transaction boundaries, optimistic locking, API surface, and verification evidence. Do not merge automatically; leave integration to the user after review.
