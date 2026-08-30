# Scope + NodeState V1 Design

**Status:** Approved direction, design candidate for implementation planning  
**Date:** 2026-08-30  
**Parent architecture:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## 1. Goal

Introduce the first real `Scope = State` vertical slice without weakening the existing `Board = View` and `Story owns canonical Node/Edge` invariants.

The product behavior this slice must make possible is:

```text
Canonical Story Node
Alice

Unscoped Board
→ Alice

Board scoped to "Chapter 10"
→ Queen Alice
```

Both Boards reference the same canonical Node. The scoped name is not copied into the canonical Node and does not leak into other Boards or Scopes.

This slice adds:

- Story-owned `Scope` records.
- optional `Board.scopeId`.
- field-level sparse `NodeState` overrides per `(scopeId, nodeId)`.
- scoped Board snapshot metadata.
- effective Node resolution in the frontend.
- Scope-aware Node Inspector autosave and Undo/Redo.
- a minimal “place existing canonical Node on Board” capability required to reuse one Node across Boards.

This slice intentionally does **not** add `EdgeState`, Scope inheritance, timeline semantics, AI reasoning, realtime collaboration, or persistent editor history.

---

## 2. Non-negotiable domain invariants

1. `Story` owns canonical `Node` and `Edge` data.
2. `Board` remains presentation-only. Scope does not turn Board into a source of story truth.
3. `Scope` is Story-owned state context.
4. `NodeState` never creates a second canonical Node identity.
5. The same canonical Node may appear on many Boards and in many Scopes.
6. `NodeState` is keyed by `(scopeId, nodeId)` and may only reference a Scope and Node from the same Story.
7. Scope state never mutates canonical Node fields implicitly.
8. Removing a Node from a Board removes Board presentation only. It does not remove `NodeState`.
9. Removing a Board does not remove canonical Node/Edge or Scope state.
10. Future Scope deletion must never delete canonical Node/Edge. Scope deletion is not exposed in this V1.
11. An unscoped Board behaves exactly like the current product and continues to edit canonical Nodes.
12. A scoped Board edits `NodeState`, not canonical Node content.
13. `properties` override is field-level sparse but object-level replacement: `properties = null` means inherit canonical properties; non-null JSON object replaces the canonical properties object for that Scope. V1 does not deep-merge individual property keys.
14. `EdgeState` is absent in this slice. Scoped Boards continue to display/edit canonical Edge content exactly as today.

---

## 3. Why this slice includes “Add existing Node to Board”

The architecture already says the same canonical Node is reused across Boards and Scopes, but the current write API only creates a new canonical Node together with its first `BoardNode`, or restores a Node that was removed from that same Board.

Without a general “place existing Node on another Board” operation, the core Scope behavior cannot be exercised through normal product flows. Creating two Nodes both named Alice would violate the intended identity model and hide Scope bugs.

Therefore this slice adds one narrow supporting use-case:

```text
Place existing canonical Node on Board
→ validate Board and Node belong to same Story
→ create BoardNode only
→ increment Board revision once
→ canonical Node remains unchanged
```

It does not add a generic Node library UI beyond the minimal picker needed by the Board Editor.

---

## 4. Domain model

The graph model becomes:

```text
Workspace
 └─ Story
     ├─ Node
     ├─ Edge
     ├─ Scope
     │   └─ NodeState
     └─ Board ── optional scopeId
         ├─ BoardNode
         └─ BoardEdge
```

### 4.1 Scope

`Scope` represents a user-defined state boundary such as Chapter 10, Episode 4, Past, Present, Season 2, or any other named context.

V1 fields:

```text
id           client- or server-generated uuid-shaped text id
storyId      FK → Story
name         string, 1..200 after trim
description  string, max 10,000
createdAt    timestamp
updatedAt    timestamp
```

V1 explicitly excludes:

- `parentScopeId`
- inheritance
- start/end dates
- chronological ordering semantics
- automatic state propagation

A future migration may add parent/order metadata without changing the V1 identity.

### 4.2 Board.scopeId

Add nullable:

```text
scopeId  nullable FK-like reference to Scope
```

The database must enforce same-Story identity with a composite relation:

```text
(scopeId, storyId) → Scope(id, storyId)
```

A `NULL scopeId` means canonical/unscoped mode.

For this V1, `scopeId` is chosen when creating a Board. Editing an existing Board’s Scope after creation is deferred. This avoids introducing live scope switching while the Editor has dirty Inspector drafts or Save Queue work.

### 4.3 NodeState

`NodeState` stores sparse overrides for canonical Node fields.

V1 fields:

```text
scopeId       FK → Scope
nodeId        FK → Node
storyId       denormalized Story id for composite integrity
name          nullable text
description   nullable text
properties    nullable JSONB object
version       positive integer, starts at 1
createdAt     timestamp
updatedAt     timestamp
```

Primary identity:

```text
(scopeId, nodeId)
```

Database integrity:

```text
(scopeId, storyId) → Scope(id, storyId)
(nodeId, storyId)  → Node(id, storyId)
```

This prevents cross-Story state even if an application validation path regresses.

`null` means “no override for this field”. Empty string is a real value only where the canonical contract already allows it; Node `name` remains non-empty after trim. An empty JSON object `{}` is a real properties override and is distinct from `null`.

A row whose override fields are all null is allowed in V1. It has no effective visual difference from no row, but retaining the row simplifies optimistic concurrency and Undo/Redo. Cleanup/compaction is deferred.

### 4.4 NodeState optimistic locking

Scoped Node text/property editing is important story data and uses optimistic locking just like canonical Node edits.

`NodeState.version` starts at 1 and increments on each successful update.

The write contract carries:

```text
version: number | null
```

Semantics:

- `version = null`: create the state only if no row exists. Existing row → `409 Conflict`.
- `version = n`: update only if current row version is `n`. Missing/stale row → `409 Conflict`.

This gives first-write compare-and-set semantics without hiding concurrent creation behind a blind upsert.

---

## 5. Effective Node semantics

The frontend and backend contracts preserve canonical and scoped state separately.

Do **not** replace `nodes[]` with pre-flattened scoped copies.

Given:

```ts
canonical = {
  name: "Alice",
  description: "Knight",
  properties: { age: 24, faction: "Guard" }
}

nodeState = {
  name: "Queen Alice",
  description: null,
  properties: { age: 31, faction: "Crown" }
}
```

The effective Node is:

```ts
{
  ...canonical,
  name: "Queen Alice",
  description: "Knight",
  properties: { age: 31, faction: "Crown" }
}
```

Resolution rule per V1 field:

```text
state field !== null ? state field : canonical field
```

No deep JSON merge is performed.

Create a pure frontend model helper for this operation so React Flow, Inspector, and tests consume one definition rather than each implementing fallback rules independently.

---

## 6. Snapshot contract

Current Board snapshot collections remain separate. Add Scope metadata and NodeState rows:

```json
{
  "story": { "id": "...", "name": "..." },
  "board": {
    "id": "...",
    "storyId": "...",
    "scopeId": "scope-10",
    "name": "Chapter 10",
    "description": "",
    "revision": 4,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "scope": {
    "id": "scope-10",
    "storyId": "...",
    "name": "Chapter 10",
    "description": "",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "nodes": [],
  "nodeStates": [],
  "edges": [],
  "boardNodes": [],
  "boardEdges": []
}
```

For an unscoped Board:

```json
{
  "board": { "scopeId": null },
  "scope": null,
  "nodeStates": []
}
```

`nodeStates` contains state only for canonical Nodes represented in the current Board snapshot. It is not a dump of every NodeState in the Scope.

The snapshot remains read-consistent within one repository transaction/query boundary.

---

## 7. API design

All endpoints remain under `/api/v1` and use shared Zod contracts.

### 7.1 List Scopes

```http
GET /api/v1/stories/:storyId/scopes?workspaceId=...
```

Authorization:

1. resolve Story
2. verify Story belongs to requested Workspace; otherwise `404`
3. require `graph:read`
4. list Scopes

Response:

```json
{ "scopes": [] }
```

### 7.2 Create Scope

```http
POST /api/v1/stories/:storyId/scopes
```

Request:

```json
{
  "workspaceId": "...",
  "name": "Chapter 10",
  "description": ""
}
```

Require `graph:update` after Story/Workspace isolation validation.

### 7.3 Create Board with optional Scope

Extend the existing Board creation request:

```json
{
  "workspaceId": "...",
  "name": "Chapter 10 Board",
  "description": "",
  "scopeId": "scope-10"
}
```

`scopeId` may be null/omitted.

If supplied, the application layer validates that Scope belongs to the same Story before capability checks that could leak cross-workspace existence. PostgreSQL composite integrity is the final boundary.

### 7.4 Place existing Node on Board

Use a distinct intent-oriented endpoint rather than overloading canonical Node creation:

```http
PUT /api/v1/boards/:boardId/nodes/:nodeId/presentation
```

Request:

```json
{
  "workspaceId": "...",
  "x": 120,
  "y": 80,
  "width": null,
  "height": null,
  "zIndex": 0,
  "style": {}
}
```

Behavior:

- validate Board, Story, Workspace, Node same-Story identity
- require `graph:update`
- insert `BoardNode`
- if the Node is already represented on that Board, return the existing representation idempotently without incrementing Board revision
- first insertion increments Board revision exactly once
- canonical Node is never inserted or updated

This endpoint is for placing an already-existing canonical Node. Existing `POST /boards/:boardId/nodes` remains “create canonical Node + first BoardNode”.

### 7.5 Write NodeState

```http
PUT /api/v1/scopes/:scopeId/nodes/:nodeId/state
```

Request:

```json
{
  "workspaceId": "...",
  "version": null,
  "name": "Queen Alice",
  "description": null,
  "properties": null
}
```

All three override fields are present in the request and may be null. The request therefore represents the complete V1 override state, which makes inverse commands deterministic.

Success response returns the persisted NodeState.

Authorization/isolation order:

1. resolve Scope
2. resolve owning Story and verify Workspace
3. resolve Node and require `node.storyId === scope.storyId`
4. require `graph:update`
5. perform compare-and-set create/update

Cross-Story/Workspace addressing returns `404`. Stale state version returns `409`.

No canonical Node PATCH occurs in this use-case.

---

## 8. Backend module boundaries

Keep `Scope` and `NodeState` inside the existing `graph` backend module for V1.

Reasoning:

- NodeState directly references graph Node identity.
- Board snapshot assembly already belongs to graph.
- adding a separate scope module would create cross-module orchestration for every snapshot and NodeState write without a current independent lifecycle benefit.

Domain additions:

```text
Scope
NodeState
Board.scopeId
BoardSnapshot.scope
BoardSnapshot.nodeStates
```

Repository capabilities should remain intent-oriented, for example:

```text
createScope
listScopes
findScope
createBoard(... scopeId)
placeNodeOnBoard
putNodeState
getBoardSnapshot
```

Application code must not import Drizzle.

---

## 9. Database migration and integrity

The migration must:

1. create `scope`
2. create `node_state`
3. add nullable `board.scope_id`
4. add same-Story unique/composite constraints and indexes
5. leave all existing Board rows with `scope_id = NULL`

Suggested indexes:

```text
scope.story_id
node_state.story_id
node_state.node_id
board.scope_id
```

No data backfill is required beyond `NULL` Board scope.

Deletion behavior:

- deleting Story cascades Scope and NodeState through Story ownership
- deleting canonical Node cascades NodeState for that Node
- deleting Scope would cascade NodeState, but Scope DELETE API is deferred
- Board references to Scope should use a restrictive database relation in V1 because automatic composite `SET NULL` could incorrectly affect non-null Story identity; no Scope DELETE path is exposed until a dedicated detach-Boards transaction is designed

---

## 10. Frontend state ownership

Zustand remains the Graph Editor working-state owner.

Add:

```text
scope: ScopeResponse | null
nodeStates: NodeStateResponse[]
```

Canonical Node data stays in `nodes`.

Do not overwrite canonical `nodes` with effective scoped values.

Introduce pure selectors/model helpers:

```text
findNodeState(scopeId, nodeId)
resolveEffectiveNode(canonicalNode, nodeState)
normalizeNodeStateOverrides(canonicalNode, effectiveDraft)
```

`normalizeNodeStateOverrides` converts an Inspector effective draft back into sparse overrides:

```text
if draft.name === canonical.name         → name = null
else                                     → name = draft.name

if draft.description === canonical.description
                                         → description = null
else                                     → description = draft.description

if deepEqual(draft.properties, canonical.properties)
                                         → properties = null
else                                     → properties = draft.properties
```

This prevents pointless overrides when the effective value matches canonical state.

---

## 11. React Flow and Inspector behavior

### 11.1 Canvas

React Flow derives its Node label from the effective Node.

Unscoped Board:

```text
canonical only
```

Scoped Board:

```text
canonical + NodeState fallback
```

BoardNode position/style remains independent and unchanged.

### 11.2 Inspector

On an unscoped Board, keep current behavior exactly:

```text
Inspector draft → update-node → Save Queue → PATCH canonical Node
```

On a scoped Board:

```text
Inspector shows effective Node values
→ draft remains raw/isolated as today
→ autosave validates effective values
→ normalize against canonical Node
→ update-node-state command
→ Save Queue
→ PUT NodeState
```

The UI should show a small Scope context indicator near the Inspector, for example:

```text
Scope: Chapter 10
```

A large new Scope editor surface is out of scope.

Properties JSON keeps the existing invalid-intermediate-draft behavior. Invalid JSON never enters Zustand or the Save Queue.

---

## 12. Commands, Save Queue, and Undo/Redo

Add a plain frontend command:

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

### Save Queue lane

Use the existing:

```text
node:<nodeId>
```

lane.

Do not introduce a separate `node-state:` lane. Canonical and scoped Node content should not race if future UI ever exposes both operations in one session. The entity identity remains the same Node.

### Optimistic local apply

`update-node-state` replaces/inserts the working `NodeState` in Zustand immediately. It never changes canonical `nodes`.

Persistence response may advance NodeState version/timestamps but must not overwrite a newer local override value, following the same stale-response rule already used by canonical edits.

### History

`update-node-state` is undoable.

The inverse stores the previous **override payload**, not previous effective Node values.

Example:

```text
canonical name = Alice
before state.name = null
forward state.name = Queen Alice
inverse state.name = null
```

This distinction is required so Undo returns to inheritance rather than persisting a redundant `Alice` override.

Coalescing key:

```text
update-node-state:<scopeId>:<nodeId>
```

Use the existing 2,000 ms Inspector coalescing window.

Dirty/invalid Inspector draft and Save Queue Error continue to block editor-level Undo/Redo.

---

## 13. TanStack Query cache behavior

Board snapshot cache remains server-state cache, not working editor state.

On NodeState mutation success, update only the matching snapshot `nodeStates` entry for that Board’s current Scope. Do not rewrite canonical `nodes`.

On canonical Node update in an unscoped Board, preserve current behavior.

Placing an existing Node on a Board should add canonical Node + BoardNode to the snapshot cache for that Board after success, while the Editor working state remains optimistic-first.

Same-Board snapshot cache changes must not trigger full Zustand rehydration after the Board session has already hydrated; preserve the current hydration guard.

---

## 14. Minimal product UI

### Story detail

Add:

- Scope list
- small `+ Scope` form
- Board creation Scope selector with default `No Scope`

Existing Board cards should display Scope name when present.

### Board Editor

Add a minimal “Add existing Node” action.

V1 interaction:

1. open picker
2. list canonical Story Nodes not currently represented on this Board
3. choose one
4. place near canvas center through `PUT .../presentation`

This picker exists to make canonical Node reuse real. It is not a full search/tag/library system.

The Board Editor should display its Scope context in the header when scoped.

No live Scope switcher is added to an already-open Board in V1.

---

## 15. Read APIs needed for existing Node placement

The picker needs canonical Story Nodes, including Nodes not represented on the current Board.

Add:

```http
GET /api/v1/stories/:storyId/nodes?workspaceId=...
```

Response:

```json
{ "nodes": [] }
```

Authorization:

1. resolve Story + Workspace isolation
2. require `graph:read`
3. list canonical Nodes by Story

This is intentionally a simple bounded list for V1. Pagination/search may be introduced when Story sizes justify it.

---

## 16. Error behavior

Use existing application error semantics.

- malformed contract → `400`
- authenticated user lacks capability after valid ownership resolution → `403`
- cross-Workspace/cross-Story Scope/Node/Board addressing → `404`
- stale NodeState version or first-write race → `409`

Frontend conflict message on scoped Node editing should parallel canonical Node conflict UX:

```text
This scoped Node state changed elsewhere. Reload before saving again.
```

A failed scoped state write keeps the effective local working value and enters Save Queue Error until explicit Retry.

---

## 17. Testing strategy

TDD is required for implementation.

### Domain/application unit tests

Cover:

- Scope list/create isolation and capabilities
- create Board with same-Story Scope
- reject cross-Story Scope on Board creation
- place existing Node on same-Story Board
- reject cross-Story Node placement
- NodeState first create with `version = null`
- NodeState CAS update
- NodeState stale update → conflict
- NodeState cross-Story/Workspace addressing → hidden 404

### PostgreSQL integration

Cover actual constraints and transactions:

- Scope same-Story unique/composite keys
- Board `scopeId` same-Story FK
- NodeState `(scopeId,nodeId)` identity
- cross-Story NodeState rejected by DB
- existing Node placement is idempotent
- first placement increments Board revision once; repeat increments zero
- scoped snapshot returns only represented Nodes’ states
- unscoped snapshot returns `scope = null`, `nodeStates = []`

### Frontend unit/component

Cover:

- effective Node fallback rules
- properties replacement semantics, not deep merge
- effective Inspector draft → sparse override normalization
- unscoped Inspector continues emitting `update-node`
- scoped Inspector emits `update-node-state`
- optimistic NodeState does not mutate canonical Node
- delayed persistence response cannot overwrite newer scoped working values
- Undo inverse restores previous sparse override, including `null`
- 2-second scoped edit coalescing
- Story Board create Scope selection
- existing Node picker filters already represented Nodes

### E2E critical path

Use a true shared canonical identity:

1. create Story
2. create Scope `Chapter 10`
3. create unscoped Board A
4. create canonical Alice on Board A
5. create scoped Board B using `Chapter 10`
6. use “Add existing Node” to place the same Alice ID on Board B
7. verify Board B initially displays `Alice`
8. edit scoped Inspector name to `Queen Alice`
9. wait for Saved
10. reload Board B → `Queen Alice`
11. open Board A → still `Alice`
12. verify canonical Node API/snapshot still has `Alice`
13. verify Board B NodeState has `Queen Alice`
14. exercise Undo/Redo on the scoped edit and reload to prove durable history replay

This E2E is the acceptance test for `Scope = State`.

---

## 18. Migration and backward compatibility

All existing Boards become unscoped automatically because `scopeId` is nullable.

Existing Board snapshots gain additive fields:

```text
board.scopeId
scope
nodeStates
```

Frontend and backend contracts move together in the same repository, so this is a coordinated versioned application change under `/api/v1` rather than a separately deployed public client compatibility problem.

Current unscoped editor flows must remain regression-covered:

- create Node
- move Node
- canonical Inspector autosave
- Relationship editing
- Board Node/Relationship removal Undo/Redo
- Save Queue Retry

---

## 19. Deferred explicitly

Not in Scope + NodeState V1:

- `EdgeState`
- Scope hierarchy / `parentScopeId`
- inheritance between Scopes
- time ranges, dates, chapter number semantics
- live Board scope switching
- changing existing Board scope after creation
- Scope delete UI/API
- NodeState icon override
- deep merge of `properties`
- state-level Board presentation overrides
- per-Scope Node visibility rules beyond Board membership
- AI reasoning over Scope
- graph traversal APIs
- collaboration / WebSocket / CRDT/Yjs
- persistent Undo history
- generalized cross-entity Save Queue dependency DAG

---

## 20. Implementation shape

The implementation should be split into small verified tasks even if delivered in one feature branch/PR:

```text
1. Scope + NodeState schema/domain/contract migration
2. Scope list/create + scoped Board creation
3. existing canonical Node list + Board placement
4. scoped Board snapshot
5. frontend effective Node model + Zustand state
6. Story/Board UI for Scope and existing Node placement
7. scoped Inspector command/persistence/autosave
8. scoped Undo/Redo
9. integration + E2E regression closure
```

No task may flatten canonical Node data into Board or Scope presentation records.

---

## 21. Acceptance criteria

The slice is complete only when all of the following are demonstrably true:

- one canonical Node ID can be represented on multiple Boards
- an unscoped Board resolves canonical Node values
- a scoped Board resolves canonical + NodeState values
- editing a scoped Node creates/updates NodeState rather than canonical Node
- editing the scoped Node does not alter the unscoped Board
- `properties` state is full-object replacement when non-null
- NodeState uses optimistic concurrency and produces `409` on stale write
- Undo/Redo for scoped Node edit persists inverse/forward NodeState through Save Queue
- removing a Node from Board leaves canonical Node and NodeState intact
- existing unscoped editor behavior remains green
- PostgreSQL enforces same-Story Scope/Node/Board state relationships
- full CI passes: architecture rules, lint, typecheck, unit, PostgreSQL integration, production build, clean-tree, and Playwright E2E
