# Scope + NodeState V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Story-owned Scope state so the same canonical Node can appear unchanged on an unscoped Board and with sparse NodeState overrides on a scoped Board, with durable autosave and Undo/Redo.

**Architecture:** Preserve `Story owns canonical Node/Edge`, `Board = View`, and `Scope = State`. PostgreSQL stores `Scope`, optional `Board.scopeId`, and sparse `(scopeId,nodeId)` `NodeState`; Board snapshots keep canonical Nodes and NodeStates separate. The frontend derives effective Nodes from canonical + state, keeps working NodeState in Zustand, and persists scoped Inspector edits as plain commands through the existing per-Node Save Queue and history system.

**Tech Stack:** TypeScript 5.9, Next.js 16.3.3, React 19.2.8, Zustand 5.0.15, TanStack Query 5.102.3, React Flow 12.11.5, Zod 4.4.3, PostgreSQL, Drizzle ORM 0.45.2 / Drizzle Kit 0.31.10, Vitest 4.1.10, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-08-30-scope-node-state-v1-design.md`

## Global Constraints

- Canonical `Node` and `Edge` remain Story-owned; neither Board nor Scope creates a second canonical identity.
- `Board` remains presentation-only. `Board.scopeId = null` means current canonical/unscoped behavior.
- `NodeState` is sparse state keyed by `(scopeId,nodeId)` and may reference only a Scope and Node from the same Story.
- V1 state fields are exactly `name`, `description`, and `properties`; `iconKey` is not stateful in this slice.
- `null` NodeState field means inherit canonical value. Non-null `properties` replaces the entire canonical properties object; there is no deep merge.
- A scoped Board edits NodeState. An unscoped Board continues to edit canonical Node.
- NodeState uses optimistic locking: `version=null` means create-if-absent; numeric version means compare-and-set update; conflicts are HTTP 409.
- Scoped and canonical Node writes share the existing `node:<nodeId>` Save Queue lane.
- Scope IDs are server-generated. Scope hierarchy, live scope switching, Scope deletion, EdgeState, AI, realtime, CRDT/Yjs, and persistent history are excluded.
- Removing a Node from a Board must not remove canonical Node or NodeState.
- Existing same-Board hydration guard, invalid Inspector draft isolation, Retry behavior, and Board-removal Undo/Redo semantics must remain intact.
- Every implementation task follows RED → GREEN → focused verification → commit before proceeding.

---

## File Structure Lock

Create:

```text
src/app/api/v1/stories/[storyId]/scopes/route.ts
src/app/api/v1/stories/[storyId]/nodes/route.ts
src/app/api/v1/boards/[boardId]/nodes/[nodeId]/presentation/route.ts
src/app/api/v1/scopes/[scopeId]/nodes/[nodeId]/state/route.ts
src/backend/modules/graph/application/create-scope/create-scope.ts
src/backend/modules/graph/application/list-scopes/list-scopes.ts
src/backend/modules/graph/application/list-story-nodes/list-story-nodes.ts
src/backend/modules/graph/application/place-node-on-board/place-node-on-board.ts
src/backend/modules/graph/application/put-node-state/put-node-state.ts
src/backend/modules/graph/application/scope.use-cases.test.ts
src/backend/modules/graph/application/node-state.use-cases.test.ts
src/frontend/features/graph-editor/model/effective-node.ts
src/frontend/features/graph-editor/model/effective-node.test.ts
tests/integration/graph/graph-scope-node-state.integration.ts
tests/e2e/scope-node-state.spec.ts
```

Modify:

```text
src/backend/infrastructure/database/schema/graph.schema.ts
src/backend/modules/graph/domain/graph.ts
src/backend/modules/graph/domain/graph.repository.ts
src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts
src/backend/modules/graph/application/create-board/create-board.ts
src/backend/modules/graph/application/board.use-cases.test.ts
src/backend/modules/graph/application/get-board-snapshot/get-board-snapshot.ts
src/contracts/graph/graph.contract.ts
src/app/api/v1/_shared/graph-http.ts
src/app/api/v1/stories/[storyId]/boards/route.ts
src/app/api/v1/boards/[boardId]/snapshot/route.ts
src/backend/infrastructure/openapi/openapi-document.ts
src/backend/infrastructure/openapi/openapi-document.test.ts
src/frontend/api/graph/graph.api.ts
src/frontend/api/graph/graph.queries.ts
src/frontend/pages/story/story-boards-page.tsx
src/frontend/pages/story/story-boards-page.test.tsx
src/frontend/features/graph-editor/model/editor-types.ts
src/frontend/features/graph-editor/store/graph-editor-store.ts
src/frontend/features/graph-editor/store/graph-editor-store.test.ts
src/frontend/features/graph-editor/commands/node-commands.ts
src/frontend/features/graph-editor/commands/editor-command.ts
src/frontend/features/graph-editor/commands/editor-command-runtime.ts
src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
src/frontend/features/graph-editor/persistence/editor-persistence.ts
src/frontend/features/graph-editor/persistence/use-editor-persistence.ts
src/frontend/features/graph-editor/save-queue/editor-save-queue.ts
src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts
src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts
src/frontend/features/graph-editor/history/editor-history-entry.ts
src/frontend/features/graph-editor/history/editor-history-entry.test.ts
src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx
src/frontend/pages/graph-editor/graph-editor-page.tsx
src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
src/frontend/features/graph-editor/AGENTS.md
docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
```

Generated migration files in Task 1:

```text
drizzle/0003_scope_node_state_v1.sql
drizzle/meta/0003_snapshot.json
drizzle/meta/_journal.json
```

---

### Task 1: Add Scope / NodeState domain, contracts, and PostgreSQL integrity

**Files:**
- Modify: `src/backend/modules/graph/domain/graph.ts`
- Modify: `src/backend/modules/graph/domain/graph.repository.ts`
- Modify: `src/contracts/graph/graph.contract.ts`
- Modify: `src/backend/infrastructure/database/schema/graph.schema.ts`
- Create/Test: `tests/integration/graph/graph-scope-node-state.integration.ts`
- Generate: `drizzle/0003_scope_node_state_v1.sql`
- Generate: `drizzle/meta/0003_snapshot.json`
- Modify generated: `drizzle/meta/_journal.json`

**Interfaces:**
- Produces domain types `Scope`, `NodeState`, `Board.scopeId`, `BoardSnapshot.scope`, `BoardSnapshot.nodeStates`.
- Produces HTTP schemas/types `scopeResponseSchema`, `nodeStateResponseSchema`, `listScopesResponseSchema`, `listStoryNodesResponseSchema`, `putNodeStateRequestSchema`, `placeBoardNodeRequestSchema`; extends `boardResponseSchema`, `createBoardRequestSchema`, and `boardSnapshotResponseSchema`.
- Extends `GraphRepository` with the exact signatures used by later tasks.

- [ ] **Step 1: Write the failing PostgreSQL integrity test**

Create `tests/integration/graph/graph-scope-node-state.integration.ts` with a first test that imports `scope`, `nodeState`, `board`, and `graphNode`, creates two Stories, and proves cross-Story state is rejected by PostgreSQL:

```ts
await db.insert(scope).values({ id: scopeId, storyId: storyA.id, name: "Chapter 10" });
await db.insert(graphNode).values(node(storyB.id, nodeId));

await expect(
  db.insert(nodeState).values({
    scopeId,
    nodeId,
    storyId: storyA.id,
    name: "Queen Alice",
    description: null,
    properties: null,
  }),
).rejects.toThrow();
```

Add a same-Story success case and a Board cross-Story Scope case.

- [ ] **Step 2: Run the new integration test and verify RED**

Run:

```bash
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
```

Expected: FAIL at compile/import time because `scope` / `nodeState` and the new domain fields do not exist.

- [ ] **Step 3: Add domain models and repository ports**

Add to `graph.ts`:

```ts
export interface Scope {
  id: string;
  storyId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NodeState {
  scopeId: string;
  nodeId: string;
  name: string | null;
  description: string | null;
  properties: JsonObject | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Extend `Board` with `scopeId: string | null`; extend `BoardSnapshot` with `scope: Scope | null` and `nodeStates: NodeState[]`.

Add these ports to `GraphRepository`:

```ts
createScope(input: { storyId: string; name: string; description: string }): Promise<Scope>;
listScopes(storyId: string): Promise<Scope[]>;
findScope(id: string): Promise<Scope | null>;
listNodes(storyId: string): Promise<GraphNode[]>;
placeNodeOnBoard(input: {
  boardId: string;
  nodeId: string;
  placement: Pick<BoardNode, "x" | "y" | "width" | "height" | "zIndex" | "style">;
}): Promise<{ node: GraphNode; boardNode: BoardNode } | null>;
putNodeState(input: {
  scopeId: string;
  nodeId: string;
  expectedVersion: number | null;
  name: string | null;
  description: string | null;
  properties: JsonObject | null;
}): Promise<NodeState | "conflict" | null>;
```

Change `createBoard` repository input to include `scopeId: string | null`.

- [ ] **Step 4: Add Zod contracts**

Add exact request/response shapes:

```ts
export const scopeResponseSchema = z.object({
  id: graphIdSchema,
  storyId: graphIdSchema,
  name: z.string(),
  description: z.string(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const nodeStateResponseSchema = z.object({
  scopeId: graphIdSchema,
  nodeId: graphIdSchema,
  name: z.string().nullable(),
  description: z.string().nullable(),
  properties: jsonObjectSchema.nullable(),
  version: z.number().int().min(1),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const putNodeStateRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  version: z.number().int().min(1).nullable(),
  name: nameSchema.nullable(),
  description: descriptionSchema.nullable(),
  properties: jsonObjectSchema.nullable(),
});
```

Extend `createBoardRequestSchema` with `scopeId: graphIdSchema.nullable().optional()` and `boardResponseSchema` with `scopeId: graphIdSchema.nullable()`. Add `scope` and `nodeStates` to `boardSnapshotResponseSchema`.

- [ ] **Step 5: Add Drizzle tables and Board composite FK**

In `graph.schema.ts`, create `scope`, create `nodeState`, add nullable `board.scopeId`, add `unique("scope_id_story_id_unique").on(scope.id, scope.storyId)`, and enforce:

```ts
foreignKey({
  name: "board_scope_story_fk",
  columns: [board.scopeId, board.storyId],
  foreignColumns: [scope.id, scope.storyId],
});

foreignKey({
  name: "node_state_scope_story_fk",
  columns: [nodeState.scopeId, nodeState.storyId],
  foreignColumns: [scope.id, scope.storyId],
}).onDelete("cascade");

foreignKey({
  name: "node_state_node_story_fk",
  columns: [nodeState.nodeId, nodeState.storyId],
  foreignColumns: [graphNode.id, graphNode.storyId],
}).onDelete("cascade");
```

Use primary key `(scopeId,nodeId)`, nullable override fields, `version default(1).notNull()`, and indexes from the spec.

- [ ] **Step 6: Generate and check the migration**

Run:

```bash
pnpm db:generate -- --name scope_node_state_v1
pnpm db:check
```

Expected generated SQL path: `drizzle/0003_scope_node_state_v1.sql`; inspect it and verify existing Boards receive nullable `scope_id` with no destructive backfill.

- [ ] **Step 7: Run focused verification and GREEN**

Run:

```bash
pnpm db:migrate
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
pnpm typecheck
```

Expected: same-Story inserts PASS, cross-Story NodeState and Board→Scope writes are rejected, TypeScript passes.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/backend/modules/graph/domain src/backend/infrastructure/database/schema/graph.schema.ts src/contracts/graph/graph.contract.ts tests/integration/graph/graph-scope-node-state.integration.ts drizzle
git commit -m "feat: add scope node state schema"
```

---

### Task 2: Add Scope APIs and scoped Board creation

**Files:**
- Create: `src/backend/modules/graph/application/create-scope/create-scope.ts`
- Create: `src/backend/modules/graph/application/list-scopes/list-scopes.ts`
- Create/Test: `src/backend/modules/graph/application/scope.use-cases.test.ts`
- Modify/Test: `src/backend/modules/graph/application/create-board/create-board.ts`
- Modify/Test: `src/backend/modules/graph/application/board.use-cases.test.ts`
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Create: `src/app/api/v1/stories/[storyId]/scopes/route.ts`
- Modify: `src/app/api/v1/stories/[storyId]/boards/route.ts`
- Modify: `src/app/api/v1/_shared/graph-http.ts`
- Modify/Test: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify/Test: `src/backend/infrastructure/openapi/openapi-document.test.ts`

**Interfaces:**
- Produces `createScope()` and `listScopes()` application use-cases.
- `createBoard()` accepts `scopeId?: string | null` and validates same-Story Scope before `graph:update` capability check.
- HTTP exposes `GET/POST /api/v1/stories/:storyId/scopes` and extends existing Board POST.

- [ ] **Step 1: Write failing application tests**

In `scope.use-cases.test.ts`, cover owner create/list, read-only list, cross-Workspace hidden 404, and create capability rejection. In `board.use-cases.test.ts`, add:

```ts
await expect(
  createBoard(
    { actorId, workspaceId, storyId, name: "Scoped", description: "", scopeId },
    dependencies,
  ),
).resolves.toMatchObject({ storyId, scopeId });
```

and a cross-Story Scope case that returns 404 before capability evaluation.

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm test -- src/backend/modules/graph/application/scope.use-cases.test.ts src/backend/modules/graph/application/board.use-cases.test.ts
```

Expected: FAIL because Scope use-cases/repository methods and `scopeId` Board creation do not exist.

- [ ] **Step 3: Implement repository Scope methods and scoped Board creation**

In `DrizzleGraphRepository`, implement `createScope`, `listScopes`, `findScope`, and pass `scopeId` through `createBoard`. Mapping functions must convert DB timestamps to domain objects and never leak DB row types.

- [ ] **Step 4: Implement application isolation order**

`createScope` / `listScopes` first resolve Story and Workspace ownership, then require capability. Update `createBoard` so a supplied Scope is resolved and verified with `scope.storyId === story.id` before `graph:update` is checked.

- [ ] **Step 5: Implement routes and response mappers**

Add `toScopeResponse()` in `graph-http.ts`. `POST scopes` parses `{workspaceId,name,description}`, generates `crypto.randomUUID()` server-side through repository/use-case convention, and returns 201. `GET scopes` parses `workspaceId` query and returns `{scopes}`. Extend Board route parsing/mapping for `scopeId`.

- [ ] **Step 6: Register OpenAPI paths and schemas**

Document Scope list/create and optional Board `scopeId`; add assertions in `openapi-document.test.ts` for `/api/v1/stories/{storyId}/scopes` and `scopeId` in Board schema.

- [ ] **Step 7: Verify GREEN**

```bash
pnpm test -- src/backend/modules/graph/application/scope.use-cases.test.ts src/backend/modules/graph/application/board.use-cases.test.ts src/backend/infrastructure/openapi/openapi-document.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/backend/modules/graph src/app/api/v1/stories src/app/api/v1/_shared/graph-http.ts src/backend/infrastructure/openapi
git commit -m "feat: add scope APIs and scoped boards"
```

---

### Task 3: List canonical Story Nodes and place an existing Node on a Board

**Files:**
- Create: `src/backend/modules/graph/application/list-story-nodes/list-story-nodes.ts`
- Create: `src/backend/modules/graph/application/place-node-on-board/place-node-on-board.ts`
- Modify/Test: `src/backend/modules/graph/application/node.use-cases.test.ts`
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Create: `src/app/api/v1/stories/[storyId]/nodes/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/nodes/[nodeId]/presentation/route.ts`
- Modify: `src/contracts/graph/graph.contract.ts`
- Modify: `src/app/api/v1/_shared/graph-http.ts`
- Modify/Test: `tests/integration/graph/graph-scope-node-state.integration.ts`
- Modify/Test: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify/Test: `src/backend/infrastructure/openapi/openapi-document.test.ts`

**Interfaces:**
- Produces `listStoryNodes()` with `graph:read` and Story/Workspace isolation.
- Produces idempotent `placeNodeOnBoard()` returning `{node,boardNode}`; first insertion increments Board revision once, repeat increments zero.
- HTTP: `GET /api/v1/stories/:storyId/nodes`, `PUT /api/v1/boards/:boardId/nodes/:nodeId/presentation`.

- [ ] **Step 1: Write failing use-case and repository integration tests**

Add Node application tests for list authorization, same-Story placement, cross-Story hidden 404. Extend integration test:

```ts
const before = await graph.findBoard(board.id);
const first = await graph.placeNodeOnBoard({ boardId: board.id, nodeId: alice.id, placement });
const second = await graph.placeNodeOnBoard({ boardId: board.id, nodeId: alice.id, placement });
const after = await graph.findBoard(board.id);

expect(first).toEqual(second);
expect(after!.revision).toBe(before!.revision + 1);
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm test -- src/backend/modules/graph/application/node.use-cases.test.ts
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
```

Expected: FAIL because list/place functions are missing.

- [ ] **Step 3: Implement repository methods**

`listNodes(storyId)` selects canonical Nodes only. `placeNodeOnBoard` runs one transaction: resolve Board Story, resolve same-Story Node, insert BoardNode with `onConflictDoNothing()`, increment Board revision only when insertion occurred, then select and return the durable BoardNode. It never inserts or updates `graph_node`.

- [ ] **Step 4: Implement application use-cases**

Both use-cases resolve Story/Board ownership before capability checks. Placement verifies Node belongs to Board Story and returns 404 for cross-Story/cross-Workspace addressing.

- [ ] **Step 5: Add contracts/routes/OpenAPI**

Add:

```ts
export const placeBoardNodeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  width: positiveNullableNumberSchema.default(null),
  height: positiveNullableNumberSchema.default(null),
  zIndex: z.number().int().default(0),
  style: jsonObjectSchema.default({}),
});
export const listStoryNodesResponseSchema = z.object({ nodes: z.array(graphNodeResponseSchema) });
```

Map the placement response with existing Node/BoardNode response schemas and document both routes.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm test -- src/backend/modules/graph/application/node.use-cases.test.ts src/backend/infrastructure/openapi/openapi-document.test.ts
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
pnpm typecheck
```

Expected: PASS, including idempotent revision behavior.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/backend/modules/graph src/app/api/v1 src/contracts/graph/graph.contract.ts tests/integration/graph/graph-scope-node-state.integration.ts src/backend/infrastructure/openapi
git commit -m "feat: place existing nodes on boards"
```

---

### Task 4: Make Board snapshots Scope-aware without flattening canonical Nodes

**Files:**
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Modify/Test: `src/backend/modules/graph/application/get-board-snapshot/get-board-snapshot.ts`
- Modify/Test: `src/backend/modules/graph/application/board-subresource-isolation.test.ts`
- Modify: `src/app/api/v1/boards/[boardId]/snapshot/route.ts`
- Modify: `src/app/api/v1/_shared/graph-http.ts`
- Modify/Test: `tests/integration/graph/graph-scope-node-state.integration.ts`

**Interfaces:**
- `GraphRepository.getBoardSnapshot(boardId)` returns `{board,scope,nodes,nodeStates,edges,boardNodes,boardEdges}`.
- Scoped snapshots include NodeState only for Nodes represented by current `BoardNode`; unscoped snapshots always return `scope:null,nodeStates:[]`.

- [ ] **Step 1: Write failing snapshot integration cases**

Create two Boards using the same Alice Node: one unscoped and one scoped. Persist Alice NodeState in the Scope plus an unrelated NodeState for a Node not represented on the scoped Board. Assert:

```ts
expect(scoped?.scope).toMatchObject({ id: scope.id });
expect(scoped?.nodes.map((node) => node.id)).toContain(alice.id);
expect(scoped?.nodeStates).toEqual([expect.objectContaining({ nodeId: alice.id })]);
expect(unscoped?.scope).toBeNull();
expect(unscoped?.nodeStates).toEqual([]);
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
```

Expected: FAIL because snapshot assembly does not load Scope/NodeState.

- [ ] **Step 3: Implement read-consistent scoped snapshot assembly**

Inside the existing snapshot transaction, load Board first; when `scopeId` is non-null load the exact same-Story Scope and query `node_state` constrained to both that Scope and current represented Node IDs. Keep canonical `nodes` unchanged.

- [ ] **Step 4: Update HTTP mapping and application tests**

Add `toNodeStateResponse()` and include `scope` / `nodeStates` in the snapshot route response. Extend isolation unit tests so foreign Workspace addressing still returns 404 before `graph:read` checks.

- [ ] **Step 5: Verify GREEN**

```bash
pnpm test -- src/backend/modules/graph/application/board-subresource-isolation.test.ts
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/backend/modules/graph src/app/api/v1/boards src/app/api/v1/_shared/graph-http.ts tests/integration/graph/graph-scope-node-state.integration.ts
git commit -m "feat: load scoped board snapshots"
```

---

### Task 5: Add effective Node model and scoped Zustand working state

**Files:**
- Create/Test: `src/frontend/features/graph-editor/model/effective-node.ts`
- Create/Test: `src/frontend/features/graph-editor/model/effective-node.test.ts`
- Modify: `src/frontend/features/graph-editor/model/editor-types.ts`
- Modify/Test: `src/frontend/features/graph-editor/store/graph-editor-store.ts`
- Modify/Test: `src/frontend/features/graph-editor/store/graph-editor-store.test.ts`

**Interfaces:**
- Produces `EditorNodeState` with nullable version/timestamps for first optimistic write.
- Produces `findNodeState(scopeId,nodeId,nodeStates)`, `resolveEffectiveNode(canonical,nodeState)`, and `normalizeNodeStateOverrides(canonical,effectiveDraft)`.
- Store owns `scope` and `nodeStates` separately from canonical `nodes` and exposes `replaceNodeState()`.

- [ ] **Step 1: Write failing pure-model tests**

Test exact fallback/replacement semantics:

```ts
expect(resolveEffectiveNode(alice, {
  ...stateBase,
  name: "Queen Alice",
  description: null,
  properties: { faction: "Crown" },
})).toMatchObject({
  name: "Queen Alice",
  description: alice.description,
  properties: { faction: "Crown" },
});
```

Assert `{}` is a real properties override and that normalization returns `null` for fields equal to canonical values.

- [ ] **Step 2: Write failing store tests**

Hydrate a scoped snapshot and assert canonical `nodes[0].name === "Alice"`, `nodeStates[0].name === "Queen Alice"`, and resolved value is `Queen Alice`. Add a `replaceNodeState` test proving canonical Nodes are unchanged.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/model/effective-node.test.ts src/frontend/features/graph-editor/store/graph-editor-store.test.ts
```

Expected: FAIL because effective model / NodeState store fields do not exist.

- [ ] **Step 4: Implement working model and pure helpers**

Define:

```ts
export type EditorNodeState = {
  scopeId: string;
  nodeId: string;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown> | null;
  version: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};
```

Implement effective field fallback with `!== null`; compare properties structurally for normalization rather than stringifying object key order.

- [ ] **Step 5: Extend GraphEditorStore**

Hydrate `scope` / `nodeStates`; implement `replaceNodeState` by `(scopeId,nodeId)` identity. Existing `detachNodeFromBoard` must not filter NodeState.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm test -- src/frontend/features/graph-editor/model/effective-node.test.ts src/frontend/features/graph-editor/store/graph-editor-store.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add src/frontend/features/graph-editor/model src/frontend/features/graph-editor/store
git commit -m "feat: add effective scoped node model"
```

---

### Task 6: Add Scope product UI and existing-Node placement through the Save Queue

**Files:**
- Modify: `src/frontend/api/graph/graph.api.ts`
- Modify: `src/frontend/api/graph/graph.queries.ts`
- Modify/Test: `src/frontend/pages/story/story-boards-page.tsx`
- Modify/Test: `src/frontend/pages/story/story-boards-page.test.tsx`
- Modify: `src/frontend/features/graph-editor/commands/node-commands.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command-runtime.ts`
- Modify/Test: `src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts`
- Modify: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/save-queue/editor-save-queue.ts`
- Modify/Test: `src/frontend/pages/graph-editor/graph-editor-page.tsx`

**Interfaces:**
- Adds frontend Scope/list-node/place-node API hooks.
- Adds non-undoable `place-board-node` command on `node:<nodeId>` lane.
- Story page creates Scopes and Boards with selected Scope; Editor can add an existing canonical Node not represented on current Board.

- [ ] **Step 1: Write failing Story page component tests**

Extend `story-boards-page.test.tsx` to mock Scope queries and assert:

```text
Scopes section renders Chapter 10
+ Scope creates Chapter 20
Create Board defaults to No Scope
select Chapter 10 → Board mutation receives scopeId
Board card shows Scope: Chapter 10
```

- [ ] **Step 2: Write failing command runtime test for placement**

Define the expected command shape:

```ts
type PlaceBoardNodeCommand = {
  type: "place-board-node";
  boardId: string;
  workspaceId: string;
  node: GraphNodeResponse;
  position: { x: number; y: number };
  createdAt: string;
};
```

Test synchronous local apply adds the supplied canonical Node plus a BoardNode but no NodeState, and persistence reconciliation keeps newer local position if the server response is stale.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm test -- src/frontend/pages/story/story-boards-page.test.tsx src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
```

Expected: FAIL because Scope hooks and `place-board-node` do not exist.

- [ ] **Step 4: Add frontend API/query functions**

Add `listScopes`, `createScope`, `listStoryNodes`, and `placeNodeOnBoard`; parse every response with shared Zod schemas. Add query keys `scopes(workspaceId,storyId)` and `nodes(workspaceId,storyId)`. On Board creation success preserve list cache behavior; on Scope creation append to Scope cache.

- [ ] **Step 5: Implement `place-board-node` command/persistence**

Add `EditorPersistence.placeBoardNode(command)`. Local apply creates only Board presentation around the supplied canonical Node. Durable call uses `PUT /presentation`. Lane key is `node:<node.id>`; command is intentionally non-undoable in this slice, so normal history handling clears Redo/breaks coalescing.

- [ ] **Step 6: Implement Story Scope UI**

Add a compact Scope list/form, Board creation `<select>` with `No Scope`, pass `scopeId`, and render Scope name on Board cards by joining `board.scopeId` to Scope query data.

- [ ] **Step 7: Implement existing Node picker in Graph Editor**

Fetch canonical Story Nodes; filter IDs already in `state.boardNodes`; a chosen Node dispatches `place-board-node` at `canvasRef.current?.getCenterPosition()`. Show Board Scope in header when `state.scope` exists.

- [ ] **Step 8: Verify GREEN**

```bash
pnpm test -- src/frontend/pages/story/story-boards-page.test.tsx src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit Task 6**

```bash
git add src/frontend/api/graph src/frontend/pages/story src/frontend/pages/graph-editor src/frontend/features/graph-editor/commands src/frontend/features/graph-editor/persistence src/frontend/features/graph-editor/save-queue
git commit -m "feat: add scope and existing node UI"
```

---

### Task 7: Persist scoped Inspector edits as optimistic NodeState commands

**Files:**
- Create: `src/backend/modules/graph/application/put-node-state/put-node-state.ts`
- Create/Test: `src/backend/modules/graph/application/node-state.use-cases.test.ts`
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Create: `src/app/api/v1/scopes/[scopeId]/nodes/[nodeId]/state/route.ts`
- Modify/Test: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify/Test: `src/backend/infrastructure/openapi/openapi-document.test.ts`
- Modify: `src/frontend/api/graph/graph.api.ts`
- Modify: `src/frontend/api/graph/graph.queries.ts`
- Modify: `src/frontend/features/graph-editor/commands/node-commands.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command-runtime.ts`
- Modify/Test: `src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts`
- Modify: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/save-queue/editor-save-queue.ts`
- Modify/Test: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts`
- Modify/Test: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts`
- Modify/Test: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Modify/Test: `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`

**Interfaces:**
- Backend `putNodeState()` implements create-if-absent / CAS and maps stale/missing expected versions to `ApplicationError("CONFLICT",409,...)`.
- Frontend adds undo-capable `update-node-state` command on existing Node lane.
- Scoped Inspector edits effective values, normalizes sparse overrides, and never mutates canonical Node.

- [ ] **Step 1: Write failing backend NodeState use-case tests**

Cover first create with `version:null`, CAS update from version 1→2, stale version 409, cross-Story 404, cross-Workspace 404, and capability denial after valid resource resolution.

- [ ] **Step 2: Write failing frontend runtime/autosave tests**

Add:

```ts
type UpdateNodeStateCommand = {
  type: "update-node-state";
  boardId: string;
  workspaceId: string;
  scopeId: string;
  nodeId: string;
  version: number | null;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown> | null;
};
```

Assert optimistic first write inserts `EditorNodeState(version:null)` and leaves canonical `nodes[0]` byte-for-byte unchanged. Simulate delayed persistence returning version 1 after a second local edit and assert metadata advances while newer local override values remain.

For autosave, hydrate a scoped Board, edit effective `Queen Alice`, and assert dispatch is `update-node-state`; hydrate unscoped and assert current `update-node` behavior remains.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
pnpm test -- src/backend/modules/graph/application/node-state.use-cases.test.ts src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts
```

Expected: FAIL because NodeState write path/command are missing.

- [ ] **Step 4: Implement repository CAS semantics**

Inside a transaction:

```text
expectedVersion = null → INSERT; unique conflict => "conflict"
expectedVersion = n    → UPDATE ... WHERE scope_id/node_id/version=n; 0 rows => "conflict"
```

Validate Scope and Node same-Story inside repository constraints as defense-in-depth; application layer still performs explicit hidden-404 checks.

- [ ] **Step 5: Implement use-case, route, OpenAPI, and Query cache update**

Route returns NodeState response. On mutation success, replace/append only matching snapshot `nodeStates` entry; do not touch snapshot `nodes`.

- [ ] **Step 6: Implement command runtime and stale-response reconciliation**

`applyEditorCommand(update-node-state)` writes the full sparse override to `EditorNodeState`. Before durable execution, `prepareEditorCommandForPersistence` reads the current working `(scopeId,nodeId)` state and replaces command `version` with its current numeric/null version. On response, preserve current override values and copy only durable version/createdAt/updatedAt metadata when the local state still exists.

- [ ] **Step 7: Make Inspector Scope-aware**

On scoped Board selection, create/replace drafts from `resolveEffectiveNode(canonical,nodeState)`. Autosave validates the effective draft, calls `normalizeNodeStateOverrides`, and dispatches `update-node-state`. Render `Scope: <name>` near Node Inspector. Edge Inspector remains canonical in V1.

- [ ] **Step 8: Verify GREEN**

```bash
pnpm test -- src/backend/modules/graph/application/node-state.use-cases.test.ts src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx src/backend/infrastructure/openapi/openapi-document.test.ts
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
pnpm typecheck
```

Expected: PASS; stale NodeState writes return 409; canonical Node remains unchanged.

- [ ] **Step 9: Commit Task 7**

```bash
git add src/backend/modules/graph src/app/api/v1/scopes src/backend/infrastructure/openapi src/frontend/api/graph src/frontend/features/graph-editor src/frontend/pages/graph-editor tests/integration/graph/graph-scope-node-state.integration.ts
git commit -m "feat: autosave scoped node state"
```

---

### Task 8: Extend Undo/Redo to sparse NodeState overrides

**Files:**
- Modify/Test: `src/frontend/features/graph-editor/history/editor-history-entry.ts`
- Modify/Test: `src/frontend/features/graph-editor/history/editor-history-entry.test.ts`
- Modify/Test: `src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx`
- Modify/Test: `src/frontend/features/graph-editor/save-queue/editor-save-queue.ts`
- Modify/Test: `src/frontend/pages/graph-editor/graph-editor-page.tsx`

**Interfaces:**
- `update-node-state` becomes `UndoableEditorCommand`.
- Inverse stores previous sparse override payload, not effective canonical values.
- Coalescing key is exactly `update-node-state:<scopeId>:<nodeId>` with existing 2,000 ms window.

- [ ] **Step 1: Write failing inverse tests**

Hydrate canonical Alice with existing NodeState `{name:null,description:"Commander",properties:null,version:4}`. Dispatch forward `{name:"Queen Alice",description:"Commander",properties:null}` and assert inverse is:

```ts
{
  type: "update-node-state",
  scopeId,
  nodeId,
  version: 4,
  name: null,
  description: "Commander",
  properties: null,
}
```

Add first-edit case where no row exists and inverse is all-null with `version:null` at history-capture time.

- [ ] **Step 2: Write failing pending-first-write Undo test**

Use a deferred first `updateNodeState` persistence call. Dispatch first scoped edit, call Undo while forward is Saving, verify inverse applies locally immediately but second durable call has not started. Resolve first response with version 1, then assert second persistence call uses `version:1` and all-null overrides.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/history/editor-history-entry.test.ts src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx
```

Expected: FAIL because `update-node-state` is not history-aware.

- [ ] **Step 4: Implement inverse derivation and coalescing**

Capture previous working NodeState by `(scopeId,nodeId)` before optimistic apply. If absent, synthesize previous sparse payload as all-null with `version:null`; do not copy canonical `Alice` into inverse. Add exact coalescing key.

- [ ] **Step 5: Preserve queued version preparation**

Keep same `node:<nodeId>` lane. The Save Queue serializes forward/inverse. Persistence preparation in Task 7 must read current durable metadata before each execution so the queued inverse uses forward response version 1.

- [ ] **Step 6: Sync Inspector draft after history replay**

When replayed command is `update-node-state`, replace an existing Node draft from current `resolveEffectiveNode(canonical,currentNodeState)` so autosave cannot reapply the pre-Undo effective draft.

- [ ] **Step 7: Verify GREEN**

```bash
pnpm test -- src/frontend/features/graph-editor/history/editor-history-entry.test.ts src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
pnpm typecheck
```

Expected: PASS, including 2,000 ms coalescing and pending-first-write Undo.

- [ ] **Step 8: Commit Task 8**

```bash
git add src/frontend/features/graph-editor/history src/frontend/features/graph-editor/save-queue src/frontend/pages/graph-editor
git commit -m "feat: undo scoped node state edits"
```

---

### Task 9: Close acceptance E2E, architecture docs, and full regression gate

**Files:**
- Create/Test: `tests/e2e/scope-node-state.spec.ts`
- Modify: `src/frontend/features/graph-editor/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`
- Modify as test fixes require only: existing Graph Editor test files; do not broaden production scope.

**Interfaces:**
- Produces the acceptance proof that one canonical Node ID has different effective names in unscoped/scoped Boards without canonical mutation.
- Locks new architecture invariants in nearest AGENTS/spec documentation.

- [ ] **Step 1: Write the failing end-to-end acceptance flow**

Create `scope-node-state.spec.ts` that performs through HTTP/UI:

```text
create Story
create Scope Chapter 10
create unscoped Board A
create canonical Alice on Board A
create scoped Board B
Add existing Node → same Alice ID on Board B
Board B initially shows Alice
Inspector edit → Queen Alice → Saved
reload Board B → Queen Alice
open Board A → Alice
assert canonical Board A snapshot Node name = Alice
Undo scoped edit → Saved → reload → Alice
Redo scoped edit → Saved → reload → Queen Alice
```

Also assert Board B snapshot contains NodeState `Queen Alice` and the exact same canonical Node ID.

- [ ] **Step 2: Run only the new E2E and verify RED**

```bash
pnpm e2e -- tests/e2e/scope-node-state.spec.ts
```

Expected before final UI wiring/regression fixes: FAIL at the first missing/incorrect scoped behavior; record the concrete failure before changing code.

- [ ] **Step 3: Fix only acceptance gaps exposed by the E2E**

Allowed fixes are synchronization/UI wiring within the approved Scope/NodeState design. Do not add EdgeState, live scope switching, hierarchy, or unrelated refactors.

- [ ] **Step 4: Update architecture instructions**

Update Graph Editor `AGENTS.md` within its existing ~500 Korean-character guard to encode:

```text
Scope가 있으면 Node 표시는 canonical+NodeState로 resolve한다.
NodeState는 canonical Node를 덮어쓰지 않는다.
scoped Node edit도 node:<id> Save Queue lane과 command/history를 사용한다.
```

Update the parent architecture design’s “Future extension” language to record that Scope + NodeState V1 is now implemented while EdgeState remains deferred.

- [ ] **Step 5: Run focused E2E and verify GREEN**

```bash
pnpm e2e -- tests/e2e/scope-node-state.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run the complete fresh verification gate**

Run in this exact order:

```bash
pnpm check
pnpm test:integration
pnpm build
git diff --exit-code
pnpm e2e
```

Expected:

```text
AGENTS validation PASS
import-boundary validation PASS
ESLint PASS
TypeScript PASS
all Vitest unit/component tests PASS
all PostgreSQL integration tests PASS
Next production build PASS
git diff --exit-code PASS
all Playwright E2E PASS
```

Do not claim the slice complete or open/merge a final integration PR until all five commands have fresh successful evidence on the exact head.

- [ ] **Step 7: Review final diff against acceptance criteria**

Explicitly verify:

```text
one canonical Node ID represented on multiple Boards
unscoped resolves canonical
scoped resolves canonical + NodeState
scoped edit writes NodeState only
properties replacement is object-level
stale NodeState returns 409
Undo/Redo persists sparse inverse/forward
Board removal preserves NodeState
PostgreSQL prevents cross-Story Scope/NodeState/Board references
existing unscoped Graph Editor tests remain green
```

- [ ] **Step 8: Commit Task 9**

```bash
git add tests/e2e/scope-node-state.spec.ts src/frontend/features/graph-editor/AGENTS.md docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
git commit -m "test: close scope node state v1"
```

---

## Plan Self-Review Checklist

- Spec sections 1–21 are covered by Tasks 1–9.
- Scope hierarchy, Scope deletion, EdgeState, live switching, AI, realtime, deep property merge, and persistent history have no implementation task.
- `properties=null` inheritance vs `{}` override is explicitly tested in Task 5.
- Same-Story DB integrity is tested before application-only behavior in Task 1.
- Existing Node reuse is a real BoardNode-only operation in Tasks 3/6 and never creates a second canonical Node.
- Scoped snapshot never flattens canonical Nodes in Task 4.
- First optimistic NodeState uses `version=null`; queued Undo after first durable write advances to version 1 through execution-time preparation in Tasks 7/8.
- `update-node-state` uses the same `node:<nodeId>` lane; no new state lane or generalized dependency DAG is introduced.
- Unscoped Inspector flow is explicitly regression-tested in Task 7.
- Full clean-tree check happens after production build and before E2E in Task 9.
