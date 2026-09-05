# Board-Owned Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pre-release Story-owned canonical Graph + Scope/State/presentation model with a Board-owned Graph where each Board directly owns its tags, Nodes, and Edges while preserving editor autosave, optimistic locking, Save Queue serialization, Undo/Redo, and reload persistence.

**Architecture:** Keep the existing Next.js full-stack modular-monolith and frontend↔contracts↔HTTP↔backend boundaries. Collapse `GraphNode + BoardNode` into one Board-owned `GraphNode`, collapse `GraphEdge + BoardEdge` into one Board-owned `GraphEdge`, remove Scope/NodeState/EdgeState entirely, and use row-level Node/Edge `version` CAS for every semantic or presentation PATCH. PostgreSQL enforces same-Board Edge endpoints with composite foreign keys. Board tags are child values, not shared entities.

**Tech Stack:** Node.js 24, pnpm 11.21.0, Next.js 16.3.3, React 19.2.8, TypeScript 5.9.3, PostgreSQL 16, Drizzle ORM 0.45.2 / Drizzle Kit 0.31.10, Zod 4.4.3, TanStack Query 5.102.3, Zustand 5.0.15, React Flow 12.11.5, Vitest 4.1.10, React Testing Library 16.3.2, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-09-06-board-owned-graph-design.md`

## Global Constraints

- `Workspace -> Story -> Board -> {Tag, Node, Edge}` is the only Graph ownership hierarchy.
- A Node or Edge belongs to exactly one Board and is never shared with another Board.
- Remove `Scope`, `NodeState`, `EdgeState`, `BoardNode`, `BoardEdge`, Story-level Node placement, and canonical/effective state resolution.
- `graph_node` owns semantic fields and `x/y/width/height/zIndex/style` directly.
- `graph_edge` owns semantic fields and `style/labelPresentation` directly.
- Edge source/target Nodes must belong to the same Board as the Edge; PostgreSQL must enforce this with composite foreign keys.
- `board.scopeId` and `board.revision` are removed.
- Every successful Node/Edge PATCH, including a Node move, increments that row's `version`; stale `expectedVersion` returns HTTP 409.
- Board metadata is last-write-wins in V1. No Board CAS token is introduced.
- Board Tag values are trimmed 1–50 character strings without a stored leading `#`; duplicate exact Tag names in one request are rejected.
- Node/Edge create continues to accept client-generated UUIDs.
- Node delete deletes incident Edges. Undo captures the full Node plus incident Edge snapshots before optimistic deletion and restores the same UUIDs transactionally.
- Edge delete Undo restores the same Edge UUID.
- Restore preserves the captured entity `version`; server-generated `createdAt`/`updatedAt` may be new timestamps.
- Preserve Zustand working state, draft validation, debounce autosave, `node:<id>` / `edge:<id>` Save Queue lanes, retry/error states, session-local Undo/Redo, and reload persistence.
- Inspector edits and Node moves use the same `node:<id>` lane so their CAS writes serialize.
- Remove all Context/Scope UI and “existing Story Node placement” UI.
- No shared Tag master, Tag management screen, server-side Tag search, realtime/CRDT, persistent Undo history, AI, billing, or compatibility migration for the old pre-release Graph data.
- Every task follows RED -> GREEN -> focused verification -> commit.

---

## Task 1: Replace Graph contracts and domain types

**Files:**
- Modify: `src/contracts/graph/graph.contract.ts`
- Modify: `src/backend/modules/graph/domain/graph.ts`
- Modify: `src/backend/modules/graph/domain/graph.repository.ts`
- Modify: `src/backend/modules/graph/application/board.use-cases.test.ts`
- Delete after references are removed: Scope/State-specific application tests and use-case directories listed in Task 4

- [ ] **Step 1: Write failing contract/domain tests for the new ownership shape**

Update `board.use-cases.test.ts` fixtures so `Board` has `tags` and no `scopeId/revision`. Add focused contract tests beside the graph contract if needed to prove:

```ts
boardResponseSchema.parse({
  id: boardId,
  storyId,
  name: "Characters",
  description: "",
  tags: ["인물", "전체"],
  createdAt: now,
  updatedAt: now,
});
```

Reject duplicate tags such as `['인물', '인물']` and tags longer than 50 characters.

Run:

```bash
pnpm vitest run src/backend/modules/graph/application/board.use-cases.test.ts
```

Expected: FAIL because current Board/Graph contracts still contain Scope/State/presentation types.

- [ ] **Step 2: Replace domain types**

Make `graph.ts` converge on this shape:

```ts
export type JsonObject = Record<string, unknown>;

export interface Board {
  id: string;
  storyId: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphNode {
  id: string;
  boardId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number;
  style: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  style: JsonObject;
  labelPresentation: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardSnapshot {
  board: Board;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

Add restore input aliases that omit server timestamps but keep identity/version.

- [ ] **Step 3: Replace repository port with Board-owned operations**

Use a small port centered on:

```ts
createBoard / updateBoard / listBoards / findBoard / getBoardSnapshot
createNode / findNode / updateNode / deleteNode / restoreNode
createEdge / findEdge / updateEdge / deleteEdge / restoreEdge
```

`findNode` and `findEdge` must take `boardId` plus entity id so Board ownership is explicit at the port boundary.

- [ ] **Step 4: Rewrite Zod contracts**

Provide only Board-owned request/response schemas. Important request rules:

```ts
createBoardRequestSchema = { workspaceId, name, description = "", tags = [] }
updateBoardRequestSchema = { workspaceId, name?, description?, tags? } // one metadata field required
createNodeRequestSchema = { workspaceId, id, name, description, iconKey, properties, x, y, width, height, zIndex, style }
updateNodeRequestSchema = { workspaceId, expectedVersion, semantic/presentation optional fields }
createEdgeRequestSchema = { workspaceId, id, sourceNodeId, targetNodeId, name, description, iconKey, properties, style, labelPresentation }
updateEdgeRequestSchema = { workspaceId, expectedVersion, semantic/presentation optional fields }
```

Responses expose `boardId` and direct presentation fields; they do not expose `storyId` on Node/Edge or any Scope/State/BoardNode/BoardEdge fields.

Restore requests contain the full captured Node/Edge data excluding server timestamps and require route id/body id equality in the route/application layer.

- [ ] **Step 5: Run focused type/unit checks**

```bash
pnpm vitest run src/backend/modules/graph/application/board.use-cases.test.ts
pnpm typecheck
```

The full typecheck is expected to remain red until dependent layers are migrated, but the Graph domain/contract errors must be reduced to downstream consumers.

- [ ] **Step 6: Commit**

```bash
git add src/contracts/graph/graph.contract.ts src/backend/modules/graph/domain src/backend/modules/graph/application/board.use-cases.test.ts
git commit -m "refactor: define board-owned graph contracts"
```

---

## Task 2: Replace PostgreSQL schema and Graph migration baseline

**Files:**
- Modify: `src/backend/infrastructure/database/schema/graph.schema.ts`
- Modify: `tests/integration/graph/graph-repository.integration.ts`
- Delete/regenerate: `drizzle/0002_white_malcolm_colcord.sql`
- Delete: `drizzle/0003_scope_node_state_v1.sql`
- Delete: `drizzle/0004_edge_state_v1.sql`
- Replace metadata from index 2 onward: `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json`

- [ ] **Step 1: Rewrite repository integration expectations first**

Add tests proving:

1. Board create/list returns Tag values.
2. Node row stores `boardId`, semantic fields, and position/style together.
3. Two Boards in the same Story may each contain a Node named `Alice` with independent ids/state.
4. An Edge can connect only Nodes from its own Board.
5. Board delete cascades Tags/Nodes/Edges.
6. Node delete cascades incident Edges.
7. stale Node/Edge PATCH returns repository conflict/null according to the port contract.
8. restore recreates the same UUID/version and fails on conflicting live UUIDs.

Run:

```bash
pnpm db:up
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
```

Expected: FAIL on the legacy tables/columns.

- [ ] **Step 2: Rewrite `graph.schema.ts`**

Create four tables only for Graph V1:

```text
board(id, story_id, name, description, created_at, updated_at)
board_tag(board_id, name, created_at)
graph_node(id, board_id, ..., x, y, width, height, z_index, style, version, timestamps)
graph_edge(id, board_id, source_node_id, target_node_id, ..., style, label_presentation, version, timestamps)
```

Add `UNIQUE(id, board_id)` on Node and Edge identity pairs and composite source/target FKs to Node with `ON DELETE CASCADE`.

- [ ] **Step 3: Rebuild the pre-release migration baseline from `0002`**

Keep `0000_auth-foundation.sql` and `0001_story-foundation.sql` untouched. Remove old Graph migrations/metadata at index >= 2, then generate a new `0002_board_owned_graph` migration from the rewritten schema. Ensure `_journal.json` has exactly 0000, 0001, and the new 0002 entry.

Use the project-local database only:

```bash
docker compose down -v
pnpm db:up
DATABASE_URL=postgresql://story_graph:story_graph@localhost:5433/story_graph pnpm db:generate -- --name board_owned_graph
pnpm db:check
pnpm db:migrate:local
```

Inspect the generated SQL and verify no Scope/State/BoardNode/BoardEdge table is created.

- [ ] **Step 4: Implement the Drizzle repository against the new tables**

Rewrite `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts` so Board tag replacement and restore operations are transactional. `deleteNode` should return the Node + incident Edge snapshot before deleting so backend tests can verify semantics, even though the frontend history captures its own pre-delete snapshot.

- [ ] **Step 5: Verify schema/repository**

```bash
pnpm db:check
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/backend/infrastructure/database/schema/graph.schema.ts src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts tests/integration/graph/graph-repository.integration.ts drizzle
git commit -m "refactor: persist graph entities under boards"
```

---

## Task 3: Rebuild Board, Node, Edge application use-cases

**Files:**
- Modify: `src/backend/modules/graph/application/create-board/create-board.ts`
- Modify: `src/backend/modules/graph/application/list-boards/list-boards.ts`
- Modify: `src/backend/modules/graph/application/get-board-snapshot/get-board-snapshot.ts`
- Create: `src/backend/modules/graph/application/update-board/update-board.ts`
- Replace legacy create/update/delete/restore directories with:
  - `create-node/create-node.ts`
  - `update-node/update-node.ts`
  - `delete-node/delete-node.ts`
  - `restore-node/restore-node.ts`
  - `create-edge/create-edge.ts`
  - `update-edge/update-edge.ts`
  - `delete-edge/delete-edge.ts`
  - `restore-edge/restore-edge.ts`
- Rewrite/add unit tests under `src/backend/modules/graph/application/*.test.ts`

- [ ] **Step 1: Write failing use-case tests**

Cover hidden-404 ordering and capability checks for:

- Board metadata update including whole Tag set replacement.
- Node/Edge operations requiring `board -> story -> workspace` ownership.
- cross-Board Edge endpoints rejected as not found/invalid.
- stale Node/Edge `expectedVersion` mapped to `CONFLICT` 409.
- restore rejects route/body id mismatch or occupied UUID.

- [ ] **Step 2: Implement a shared authorization pattern without introducing a generic framework**

Each use-case should explicitly:

```text
find Board -> find Story -> verify workspace -> require graph capability -> perform Board-scoped entity operation
```

Do not infer Story ownership from Node/Edge fields; those fields no longer exist.

- [ ] **Step 3: Implement Board create/update tags**

`createBoard` forwards normalized tags. `updateBoard` replaces tags only when `tags` is present; omitted tags leave the set unchanged.

- [ ] **Step 4: Implement direct Node/Edge update semantics**

Node PATCH accepts semantic fields and position/presentation fields in one CAS operation. Edge PATCH does the same for semantic fields and presentation fields.

- [ ] **Step 5: Implement transactional restore semantics**

Node restore inserts the captured Node first and then every captured incident Edge, validating that each restored Edge is incident to the restored Node and that the other endpoint already exists in the Board or is the restored Node. Entire restore succeeds or fails as one transaction.

- [ ] **Step 6: Run unit tests**

```bash
pnpm vitest run src/backend/modules/graph/application
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/backend/modules/graph/application
git commit -m "refactor: rebuild graph use cases around boards"
```

---

## Task 4: Replace HTTP routes, serializers, and OpenAPI; delete Scope routes

**Files:**
- Modify: `src/app/api/v1/_shared/graph-http.ts`
- Modify: `src/app/api/v1/stories/[storyId]/boards/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/route.ts`
- Modify: `src/app/api/v1/boards/[boardId]/snapshot/route.ts`
- Modify: `src/app/api/v1/boards/[boardId]/nodes/route.ts`
- Modify: `src/app/api/v1/boards/[boardId]/nodes/[nodeId]/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/nodes/[nodeId]/restore/route.ts`
- Modify: `src/app/api/v1/boards/[boardId]/edges/route.ts`
- Modify: `src/app/api/v1/boards/[boardId]/edges/[edgeId]/route.ts`
- Create: `src/app/api/v1/boards/[boardId]/edges/[edgeId]/restore/route.ts`
- Delete: `src/app/api/v1/stories/[storyId]/nodes/route.ts`
- Delete: `src/app/api/v1/stories/[storyId]/scopes/route.ts`
- Delete: `src/app/api/v1/scopes/[scopeId]/nodes/[nodeId]/state/route.ts`
- Delete: `src/app/api/v1/scopes/[scopeId]/edges/[edgeId]/state/route.ts`
- Delete: `src/app/api/v1/nodes/[nodeId]/route.ts`
- Delete: `src/app/api/v1/edges/[edgeId]/route.ts`
- Delete: `src/app/api/v1/boards/[boardId]/nodes/[nodeId]/presentation/route.ts`
- Modify: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify: `src/backend/infrastructure/openapi/openapi-document.test.ts`
- Rewrite integration tests under `tests/integration/graph/`

- [ ] **Step 1: Turn OpenAPI and API integration tests red**

OpenAPI must contain:

```text
GET/POST /api/v1/stories/{storyId}/boards
PATCH    /api/v1/boards/{boardId}
GET      /api/v1/boards/{boardId}/snapshot
POST     /api/v1/boards/{boardId}/nodes
PATCH/DELETE /api/v1/boards/{boardId}/nodes/{nodeId}
POST     /api/v1/boards/{boardId}/nodes/{nodeId}/restore
POST     /api/v1/boards/{boardId}/edges
PATCH/DELETE /api/v1/boards/{boardId}/edges/{edgeId}
POST     /api/v1/boards/{boardId}/edges/{edgeId}/restore
```

Assert old Scope, generic Node/Edge, and presentation paths are absent.

- [ ] **Step 2: Simplify serializers**

`graph-http.ts` exports only `toBoardResponse`, `toGraphNodeResponse`, `toGraphEdgeResponse`, and `toBoardSnapshotResponse`.

- [ ] **Step 3: Replace route handlers**

Route handlers remain composition-only. Node/Edge PATCH route params always include Board id and entity id. Restore is POST on a `/restore` subresource, not PUT on the entity route.

- [ ] **Step 4: Rewrite Graph API integration suite**

Delete `graph-scope-node-state.integration.ts`. Rewrite removal/restore/list/snapshot/capability tests to assert actual entity deletion and Board isolation. Keep test setup through real PostgreSQL.

- [ ] **Step 5: Verify API/OpenAPI**

```bash
pnpm vitest run src/backend/infrastructure/openapi/openapi-document.test.ts
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v1 src/backend/infrastructure/openapi tests/integration/graph
git commit -m "refactor: expose board-owned graph api"
```

---

## Task 5: Simplify frontend Graph API and Story Board UX with Tags

**Files:**
- Rewrite: `src/frontend/api/graph/graph.api.ts`
- Rewrite: `src/frontend/api/graph/graph.queries.ts`
- Modify: `src/frontend/pages/story/story-boards-page.tsx`
- Modify: `src/frontend/pages/story/story-boards-page.test.tsx`
- Create: `src/frontend/pages/story/board-tags.ts`
- Create: `src/frontend/pages/story/board-tags.test.ts`

- [ ] **Step 1: Write Tag parser/UI tests first**

Implement client validation around comma-separated input:

```text
#인물, 전체 -> ["인물", "전체"]
인물, 인물 -> duplicate error
51-char tag -> length error
blank segments -> ignored
```

Story page tests must prove:

- no `컨텍스트` UI exists;
- create Board submits tags and navigates to the created Board;
- Board cards render `#tag` labels;
- filter chips narrow the visible Board cards client-side;
- metadata edit can replace name/description/tags.

Run:

```bash
pnpm vitest run src/frontend/pages/story/board-tags.test.ts src/frontend/pages/story/story-boards-page.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Rewrite frontend Graph API**

Keep only:

```text
listBoards/createBoard/updateBoard/getBoardSnapshot
createNode/updateNode/deleteNode/restoreNode
createEdge/updateEdge/deleteEdge/restoreEdge
```

Query keys become only Board list and Board snapshot keys. Mutations update those caches with direct Node/Edge rows.

- [ ] **Step 3: Remove Context UI and add Tags**

Delete Scope query/mutation/state/selector/management section from `StoryBoardsPage`. Add optional description and comma-separated Tag fields to Board create/edit dialogs. Build Tag filter chips from the union of `boards[].tags` without a server query.

- [ ] **Step 4: Verify focused frontend tests**

```bash
pnpm vitest run src/frontend/pages/story
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/api/graph src/frontend/pages/story
git commit -m "feat: simplify boards and add tag filtering"
```

---

## Task 6: Collapse Graph Editor state to direct Node/Edge rows

**Files:**
- Rewrite: `src/frontend/features/graph-editor/model/editor-types.ts`
- Delete: `src/frontend/features/graph-editor/model/effective-node.ts`
- Delete: `src/frontend/features/graph-editor/model/effective-node.test.ts`
- Delete: `src/frontend/features/graph-editor/model/effective-edge.ts`
- Delete: `src/frontend/features/graph-editor/model/effective-edge.test.ts`
- Rewrite: `src/frontend/features/graph-editor/store/graph-editor-store.ts`
- Rewrite: `src/frontend/features/graph-editor/store/graph-editor-store.test.ts`
- Replace/remove: `src/frontend/features/graph-editor/store/graph-editor-board-removal.test.ts`
- Modify: `src/frontend/features/graph-editor/actions/add-node-dialog.tsx`
- Modify: `src/frontend/features/graph-editor/actions/add-node-dialog.test.tsx`

- [ ] **Step 1: Write the direct-state store tests**

Target store API:

```ts
type DeletedNodeSnapshot = { node: GraphNodeResponse; edges: GraphEdgeResponse[] };

type GraphEditorState = {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
  hydrate(snapshot: BoardSnapshotResponse): void;
  addOptimisticNode(node: GraphNodeResponse): void;
  replaceNode(node: GraphNodeResponse): void;
  setNodePosition(nodeId: string, position: {x:number;y:number}): void;
  deleteNode(nodeId: string): DeletedNodeSnapshot | null;
  restoreNode(snapshot: DeletedNodeSnapshot): void;
  addOptimisticEdge(edge: GraphEdgeResponse): void;
  replaceEdge(edge: GraphEdgeResponse): void;
  deleteEdge(edgeId: string): GraphEdgeResponse | null;
  restoreEdge(edge: GraphEdgeResponse): void;
};
```

Test that deleting a Node removes its incident Edges from working state and returns all data needed for Undo.

- [ ] **Step 2: Implement direct store and delete effective models**

Node positions live on `state.nodes`. No `scope`, `nodeStates`, `edgeStates`, `boardNodes`, or `boardEdges` remain.

- [ ] **Step 3: Simplify Add Node dialog**

Remove `existingNodes`, `onPlace`, selector, and copy about sharing Story nodes. The dialog only creates a new Board-owned Node.

- [ ] **Step 4: Run focused tests**

```bash
pnpm vitest run src/frontend/features/graph-editor/store src/frontend/features/graph-editor/actions/add-node-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/features/graph-editor/model src/frontend/features/graph-editor/store src/frontend/features/graph-editor/actions/add-node-dialog.tsx src/frontend/features/graph-editor/actions/add-node-dialog.test.tsx
git commit -m "refactor: collapse editor state to board entities"
```

---

## Task 7: Rewrite editor commands, Save Queue persistence, Inspector autosave, and Undo/Redo

**Files:**
- Rewrite: `src/frontend/features/graph-editor/commands/node-commands.ts`
- Rewrite: `src/frontend/features/graph-editor/commands/edge-commands.ts`
- Rewrite: `src/frontend/features/graph-editor/commands/editor-command.ts`
- Rewrite: `src/frontend/features/graph-editor/commands/editor-command-runtime.ts`
- Rewrite tests in `src/frontend/features/graph-editor/commands/`
- Rewrite: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`
- Rewrite: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/save-queue/editor-save-queue.ts`
- Modify: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.ts`
- Rewrite relevant Save Queue tests
- Rewrite: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts`
- Rewrite: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts`
- Rewrite: `src/frontend/features/graph-editor/history/editor-history-entry.ts`
- Rewrite History tests including board-node/board-edge removal history files

- [ ] **Step 1: Define the new command union in tests first**

Commands become:

```text
create-node
move-node
update-node
delete-node
restore-node
create-edge
update-edge
delete-edge
restore-edge
```

No `storyId`, `place-board-node`, State commands, or Board presentation commands.

`move-node` and update commands carry `expectedVersion`; `prepareEditorCommandForPersistence` rebases that version from the latest current entity immediately before the serialized request executes.

- [ ] **Step 2: Preserve Save Queue lane/dependency behavior**

`create-node/move-node/update-node/delete-node/restore-node` use `node:<id>`. Edge commands use `edge:<id>`. A Node delete waits for incident Edge lanes, preserving the current removal dependency guarantee.

- [ ] **Step 3: Rewrite optimistic apply/reconcile**

A move updates `GraphNode.x/y` directly. Persisted responses refresh version/timestamps while preserving any newer optimistic fields already queued in the same lane.

- [ ] **Step 4: Rewrite Inspector autosave**

Remove all Scope branches. Every valid Node draft dispatches `update-node`; every valid Edge draft dispatches `update-edge`.

- [ ] **Step 5: Rewrite history snapshots**

Before `delete-node`, history reads the current Node plus incident Edges and creates `restore-node` as the inverse. Before `delete-edge`, history stores the entire Edge. Restore inverses are deletes.

- [ ] **Step 6: Run focused editor core tests**

```bash
pnpm vitest run src/frontend/features/graph-editor/commands src/frontend/features/graph-editor/save-queue src/frontend/features/graph-editor/inspector src/frontend/features/graph-editor/history
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/frontend/features/graph-editor/commands src/frontend/features/graph-editor/persistence src/frontend/features/graph-editor/save-queue src/frontend/features/graph-editor/inspector src/frontend/features/graph-editor/history
git commit -m "refactor: preserve editor persistence on board-owned rows"
```

---

## Task 8: Simplify Graph Editor page and destructive-delete copy

**Files:**
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Rewrite Graph Editor page tests, including:
  - `graph-editor-page.test.tsx`
  - `graph-editor-history.test.tsx`
  - `graph-editor-save-state.test.tsx`
  - `graph-editor-inspector.test.tsx`
  - `graph-editor-board-removal.test.tsx`
  - `graph-editor-board-removal-failure.test.tsx`
  - `graph-editor-edge-failure.test.tsx`
- Delete: `src/frontend/pages/graph-editor/graph-editor-scoped-inspector.test.tsx`
- Modify: `src/frontend/features/graph-editor/inspector/graph-inspector.tsx`

- [ ] **Step 1: Turn page tests red on direct Board-owned behavior**

Remove all `listStoryNodes`, Scope/State, place-existing-node mocks. Snapshot fixtures contain direct Node positions and Edge presentation fields.

- [ ] **Step 2: Simplify page derivation**

Render canvas Nodes as:

```ts
state.nodes.map((node) => ({
  id: node.id,
  name: node.name,
  position: { x: node.x, y: node.y },
}))
```

Inspector selection uses the direct Node/Edge row. No effective resolver imports remain.

- [ ] **Step 3: Update removal copy**

For Node: explain that deleting it from this Board also deletes its connected relationships and can be undone in the current session. For Edge: explain that the relationship itself is deleted from this Board and can be undone. Remove all “Story original remains” wording.

- [ ] **Step 4: Verify page tests**

```bash
pnpm vitest run src/frontend/pages/graph-editor
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/pages/graph-editor src/frontend/features/graph-editor/inspector/graph-inspector.tsx
git commit -m "refactor: simplify graph editor for board ownership"
```

---

## Task 9: Replace legacy Scope E2E with Board isolation, Tags, and true delete/restore acceptance

**Files:**
- Delete: `tests/e2e/scope-node-state.spec.ts`
- Delete: `tests/e2e/scope-edge-state.spec.ts`
- Modify: `tests/e2e/product-ui-authoring.spec.ts`
- Modify: `tests/e2e/node-board-removal-history.spec.ts`
- Modify: `tests/e2e/relationship-board-removal-history.spec.ts`
- Create: `tests/e2e/board-owned-isolation.spec.ts`
- Create: `tests/e2e/board-tags.spec.ts`

- [ ] **Step 1: Write Board isolation E2E**

Flow:

1. Create one Story.
2. Create Board A and Board B.
3. Create `Alice` independently on both Boards.
4. Rename only Board A's Alice.
5. Reload both Boards.
6. Assert Board A is changed and Board B remains `Alice`.

- [ ] **Step 2: Write Tag E2E**

Create Boards with distinct tags from the Story UI and prove filter chips narrow the Board cards without a network Tag search.

- [ ] **Step 3: Rewrite Node delete/Undo E2E**

After delete, API snapshot must contain neither the Node nor its incident Edge. Undo must restore the same Node id and Edge id; reload must preserve the restored rows. Redo must delete again.

- [ ] **Step 4: Rewrite Edge delete/Undo E2E**

Same rule for Edge identity and reload persistence.

- [ ] **Step 5: Update product authoring acceptance**

Board create has no Context. Node create response is a direct Node rather than `{node, boardNode}`. Move PATCH uses `/boards/:boardId/nodes/:nodeId` with `expectedVersion`.

- [ ] **Step 6: Run E2E subset**

```bash
pnpm e2e -- tests/e2e/product-ui-authoring.spec.ts tests/e2e/board-owned-isolation.spec.ts tests/e2e/board-tags.spec.ts tests/e2e/node-board-removal-history.spec.ts tests/e2e/relationship-board-removal-history.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e
git commit -m "test: cover board-owned graph acceptance"
```

---

## Task 10: Remove legacy references, verify the whole repository, and prepare review

**Files:**
- Search/clean all tracked source/docs/tests for legacy executable references
- Preserve historical Superpowers spec/plan documents unless they actively drive runtime validation
- Modify documentation only where current architecture guidance still conflicts

- [ ] **Step 1: Prove legacy runtime symbols are gone**

Run repository searches and inspect every hit:

```bash
git grep -nE 'Scope|NodeState|EdgeState|BoardNode|BoardEdge|scopeId|nodeStates|edgeStates|boardNodes|boardEdges|placeBoardNode|listStoryNodes' -- 'src/**' 'tests/**'
```

Expected: no runtime/test references to the removed Graph model. Historical docs under `docs/superpowers/` may retain the terms as historical records.

- [ ] **Step 2: Run architecture and static checks**

```bash
pnpm check:agents
pnpm check:boundaries
pnpm lint
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Recreate a clean local database and run persistence checks**

```bash
docker compose down -v
pnpm db:up
pnpm db:check
pnpm db:migrate:local
pnpm test:integration
```

Expected: PASS from an empty database using only the new migration chain.

- [ ] **Step 4: Build and run the full E2E suite**

```bash
pnpm build
pnpm e2e
```

Expected: PASS.

- [ ] **Step 5: Verify a clean tracked tree and compare against main**

```bash
git status --short
git diff --check main...HEAD
git log --oneline --decorate main..HEAD
```

Expected: no uncommitted tracked changes; no whitespace errors; commits are task-scoped.

- [ ] **Step 6: Open a review PR**

Use title:

```text
refactor: make graph entities board-owned
```

PR body must summarize the ownership reset, migration reset precondition, preserved editor guarantees, removed Scope/State routes, Tag UX, and exact verification commands/results.
