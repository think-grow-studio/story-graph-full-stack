# EdgeState V1 Design

**Status:** Approved direction, written design for review  
**Date:** 2026-08-31  
**Parent architecture:** `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`  
**Precedent:** `docs/superpowers/specs/2026-08-30-scope-node-state-v1-design.md`

## 1. Goal

Extend the implemented `Scope = State` model from Nodes to Relationships without weakening the existing invariants:

- Story owns canonical Node/Edge identity and topology.
- Board remains presentation-only.
- Scope stores state overrides, not copies of canonical entities.

The target behavior is:

```text
Canonical Story Edge
Alice -- "serves" --> Crown

Unscoped Board
→ "serves"

Board scoped to "Chapter 10"
→ "rules"
```

Both Boards reference the same canonical Edge ID. The scoped relationship text is stored in `EdgeState`; the canonical Edge remains unchanged.

This slice adds:

- sparse `(scopeId, edgeId)` `EdgeState` rows,
- scoped Board snapshot `edgeStates`,
- effective Edge resolution in the frontend,
- Scope-aware Relationship Inspector autosave,
- optimistic CAS persistence,
- Undo/Redo for scoped Relationship edits,
- acceptance coverage proving canonical and scoped relationship state remain isolated.

This slice intentionally does **not** add relationship existence/activation state, source/target overrides, Scope inheritance, Scope deletion, live scope switching, AI reasoning, realtime collaboration, or persistent history.

---

## 2. Chosen approach

### Recommended: dedicated `edge_state` table mirroring `node_state`

Use a first-class EdgeState model with the same sparse override and optimistic-locking semantics as NodeState.

Why:

- preserves database-level same-Story integrity,
- keeps `Board = View`,
- keeps canonical Edge identity/topology stable,
- reuses proven NodeState application/frontend patterns,
- gives deterministic inverse commands for Undo/Redo,
- avoids premature generic abstractions.

### Rejected: generic `entity_state` table

A polymorphic Node/Edge state table would require type discriminators, weaker foreign keys, more conditional validation, and harder repository contracts. The current product has only two graph entity kinds, so this abstraction creates complexity without leverage.

### Rejected: store scoped content on `BoardEdge`

That would make the same Scope state differ per Board and turn Board presentation into story truth, directly violating `Board = View`.

---

## 3. Non-negotiable domain invariants

1. `Story` owns canonical `Node` and `Edge` data.
2. Canonical Edge identity is one `edgeId` reused across Boards and Scopes.
3. Edge source/target topology is canonical Story data and is not overrideable in EdgeState V1.
4. `Board` owns only placement/presentation. BoardEdge is not scoped story state.
5. `Scope` is the state context.
6. `EdgeState` is keyed by `(scopeId, edgeId)` and may reference only a Scope and Edge from the same Story.
7. Scoped Edge edits never mutate canonical Edge fields implicitly.
8. Removing a Relationship from a Board removes BoardEdge presentation only. It does not delete canonical Edge or EdgeState.
9. Removing a Node from a Board may remove represented incident BoardEdges, but it does not delete their EdgeState rows.
10. An unscoped Board continues to read/edit canonical Edge content exactly as before.
11. A scoped Board reads the effective Edge and writes EdgeState.
12. V1 state fields are exactly `name`, `description`, and `properties`.
13. `iconKey` remains canonical in this slice.
14. `sourceNodeId` and `targetNodeId` remain canonical and immutable through scoped editing.
15. Edge existence/active state is not modeled in V1. Whether a relationship is represented on a particular Board remains Board presentation behavior, not Scope truth.
16. `properties = null` means inherit canonical properties; non-null properties replace the whole canonical properties object. No deep merge.
17. An all-null EdgeState row is allowed for deterministic concurrency/history semantics.

---

## 4. Domain model

The current model becomes:

```text
Workspace
 └─ Story
     ├─ Node
     ├─ Edge
     ├─ Scope
     │   ├─ NodeState
     │   └─ EdgeState
     └─ Board ── optional scopeId
         ├─ BoardNode
         └─ BoardEdge
```

### 4.1 EdgeState

V1 fields:

```text
scopeId       FK → Scope
edgeId        FK → GraphEdge
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
(scopeId, edgeId)
```

Database integrity:

```text
(scopeId, storyId) → Scope(id, storyId)
(edgeId, storyId)  → GraphEdge(id, storyId)
```

This must be enforced in PostgreSQL in addition to application validation.

Deletion behavior:

- deleting Story cascades EdgeState through Story-owned Scope/Edge relations,
- deleting canonical Edge cascades its EdgeState rows,
- deleting Scope cascades EdgeState, though Scope DELETE remains deferred,
- deleting Board/BoardEdge never deletes EdgeState.

Suggested indexes:

```text
edge_state.story_id
edge_state.edge_id
```

---

## 5. Sparse override semantics

Canonical:

```ts
{
  name: "serves",
  description: "Alice serves the Crown",
  properties: { trust: 4, public: true },
  iconKey: "service",
  sourceNodeId: aliceId,
  targetNodeId: crownId
}
```

Scoped state:

```ts
{
  name: "rules",
  description: null,
  properties: { trust: 9, public: true }
}
```

Effective Edge:

```ts
{
  ...canonical,
  name: "rules",
  description: "Alice serves the Crown",
  properties: { trust: 9, public: true }
}
```

Resolution per V1 field:

```text
state field !== null ? state field : canonical field
```

The following always come from canonical Edge in V1:

```text
id
storyId
sourceNodeId
targetNodeId
iconKey
```

No deep JSON merge is performed.

When an effective Inspector draft equals the canonical value, normalize that field back to `null` so unnecessary overrides are not stored.

---

## 6. Optimistic locking

EdgeState follows NodeState CAS semantics exactly.

Write request carries:

```text
version: number | null
```

Semantics:

- `version = null`: create only if no EdgeState row exists; existing row → `409 Conflict`.
- `version = n`: update only when current row version is `n`; missing/stale row → `409 Conflict`.
- every successful update increments version once.

Do not use blind upsert because it would hide concurrent first creation.

Canonical Edge and scoped EdgeState writes for the same Edge share the existing Save Queue lane:

```text
edge:<edgeId>
```

This serializes canonical edit, scoped edit, BoardEdge removal/restore, and related durable work for one relationship while unrelated edges remain independent.

---

## 7. Board snapshot contract

Keep canonical and scoped state separate. Do not flatten scoped copies into `edges[]`.

Scoped snapshot:

```json
{
  "scope": { "id": "...", "name": "Chapter 10" },
  "nodes": [],
  "nodeStates": [],
  "edges": [],
  "edgeStates": [],
  "boardNodes": [],
  "boardEdges": []
}
```

Unscoped snapshot:

```json
{
  "scope": null,
  "nodeStates": [],
  "edgeStates": []
}
```

`edgeStates` contains rows only for canonical Edges represented in the current Board snapshot. It is not every EdgeState in the Scope.

Snapshot assembly must remain read-consistent and continue returning canonical `edges[]` unchanged.

---

## 8. API design

Add one intent-oriented state write endpoint:

```http
PUT /api/v1/scopes/:scopeId/edges/:edgeId/state
```

Request:

```json
{
  "workspaceId": "...",
  "version": null,
  "name": "rules",
  "description": null,
  "properties": null
}
```

All V1 override fields are present and nullable. The request represents the complete sparse EdgeState value, which makes inverse history deterministic.

Success returns persisted EdgeState.

Isolation/authorization order:

1. resolve Scope,
2. resolve owning Story and verify requested Workspace; mismatch → `404`,
3. resolve Edge and require `edge.storyId === scope.storyId`; mismatch/missing → `404`,
4. require `graph:update`,
5. perform create-if-absent / compare-and-set write,
6. stale version → `409 Conflict`.

No canonical `PATCH /edges/:edgeId` occurs in this use-case.

The existing canonical Edge PATCH endpoint remains unchanged for unscoped Boards.

### 8.1 Reuse existing BoardEdge materialization

EdgeState acceptance requires the same canonical Edge to be represented on more than one Board. Do **not** add another “place existing Edge” endpoint in this slice.

The existing idempotent BoardEdge PUT flow already supports this safely:

```http
PUT /api/v1/boards/:boardId/edges/:edgeId
```

Its current backend behavior already:

- resolves the target Board and canonical Edge in the same Story,
- requires both canonical Edge endpoints to be represented as BoardNodes on the target Board,
- inserts BoardEdge presentation only,
- increments Board revision only on first insertion,
- returns the existing BoardEdge without revision increment on retry,
- never creates or mutates canonical Edge.

Although the application use-case is named `restoreEdgeToBoard` because it originated from Undo/Redo, the operation is already a valid idempotent BoardEdge materialization primitive. EdgeState V1 reuses it rather than adding a duplicate API.

---

## 9. Backend boundaries

Keep EdgeState inside the existing `graph` module, mirroring NodeState.

Domain additions:

```text
EdgeState
BoardSnapshot.edgeStates
```

Repository capability:

```ts
putEdgeState(input: {
  scopeId: string;
  edgeId: string;
  expectedVersion: number | null;
  name: string | null;
  description: string | null;
  properties: JsonObject | null;
}): Promise<EdgeState | "conflict" | null>;
```

`getBoardSnapshot` must fetch only EdgeState rows for represented BoardEdges when the Board has a Scope.

Application code remains independent of Drizzle.

HTTP mapping follows existing graph response serializers and OpenAPI registration patterns.

---

## 10. Frontend working state

Zustand remains the Graph Editor working-state owner.

Add:

```text
edgeStates: EditorEdgeState[]
```

Canonical `edges` remain untouched.

Working model:

```ts
type EditorEdgeState = {
  scopeId: string;
  edgeId: string;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown> | null;
  version: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};
```

Create a pure model helper parallel to `effective-node.ts`:

```text
findEdgeState(scopeId, edgeId)
resolveEffectiveEdge(canonicalEdge, edgeState)
normalizeEdgeStateOverrides(canonicalEdge, effectiveDraft)
```

Do not introduce a generic `effective-entity.ts` abstraction in this slice. Node and Edge helpers may be unified later only if a real third consumer appears.

---

## 11. Canvas and Inspector behavior

### 11.1 Relationship rendering

Any relationship label/content derived from canonical Edge must use the effective Edge on a scoped Board.

Topology remains canonical:

```text
sourceNodeId / targetNodeId → canonical Edge only
```

Node labels continue to use effective Node resolution independently.

### 11.2 Relationship Inspector

The current Inspector draft model exposes only `name`, `description`, and `properties`, so EdgeState V1 exactly covers every editable Relationship content field currently shown in the Inspector. `iconKey` is not accidentally editable through this scoped path.

Unscoped Board remains unchanged:

```text
Inspector effective draft
→ update-edge
→ edge:<edgeId> Save Queue
→ PATCH canonical Edge
```

Scoped Board:

```text
canonical Edge + EdgeState
→ resolve effective Edge
→ Inspector draft
→ normalize sparse overrides against canonical Edge
→ update-edge-state command
→ edge:<edgeId> Save Queue
→ PUT Scope EdgeState
```

Invalid drafts remain isolated from the durable queue just like current Inspector behavior.

---

## 12. Command runtime and persistence reconciliation

Add an `update-edge-state` EditorCommand parallel to `update-node-state`.

Command contains complete sparse state:

```text
boardId
workspaceId
scopeId
edgeId
version
name
description
properties
```

Optimistic apply:

- validate Scope matches current Board Scope,
- validate canonical Edge exists,
- replace/add only the working EdgeState row,
- never mutate canonical Edge.

Persistence:

- call `PUT /scopes/:scopeId/edges/:edgeId/state`,
- reconcile server version/timestamps,
- preserve newer local override values if another local command already advanced working state.

Failure behavior:

- retain optimistic working state,
- expose existing aggregate `Error` / explicit Retry behavior,
- 409 message identifies scoped Relationship state conflict,
- no infinite automatic retry.

---

## 13. Undo/Redo semantics

`update-edge-state` is Undoable.

The inverse stores the previous **sparse EdgeState**, not the effective Edge.

Example:

```text
canonical name = "serves"
previous state.name = null
edit effective name to "rules"
```

Inverse must restore:

```text
state.name = null
```

not:

```text
state.name = "serves"
```

Otherwise later canonical changes would no longer flow through inheritance.

First edit with no existing row uses inverse:

```text
version = null
name = null
description = null
properties = null
```

An all-null row is acceptable in V1.

Undo/Redo reuses the same `edge:<edgeId>` Save Queue lane and remains session-local. Reload clears history, as today.

---

## 14. Interaction with Board removal

Relationship Board removal and restore already operate on BoardEdge presentation only.

With EdgeState:

```text
remove-board-edge
→ BoardEdge removed
→ canonical Edge retained
→ EdgeState retained
```

Undo:

```text
restore-board-edge
→ prior BoardEdge presentation restored
→ same canonical Edge + same EdgeState become effective again
```

Because all operations share `edge:<edgeId>`, scoped state writes cannot overtake BoardEdge removal/restore durability for the same relationship.

Removing a Node from a Board may temporarily remove represented incident BoardEdges, but must not delete their EdgeState rows.

---

## 15. Migration

Create a new additive migration after the merged Scope/NodeState migration.

It must:

1. create `edge_state`,
2. create primary key `(scope_id, edge_id)`,
3. add same-Story composite FKs to `scope` and `graph_edge`,
4. add `story_id` and `edge_id` indexes,
5. make no destructive changes to existing NodeState, Board, Edge, or BoardEdge rows.

No backfill is needed.

---

## 16. Testing strategy

### Database/integration

Prove:

- same-Story Scope + EdgeState succeeds,
- cross-Story Scope/Edge insert is rejected by PostgreSQL,
- create-if-absent succeeds at `version=null`,
- duplicate first creation conflicts,
- numeric CAS update increments version,
- stale version returns conflict,
- scoped Board snapshot contains only represented EdgeState rows,
- unscoped snapshot returns `edgeStates: []`,
- removing BoardEdge does not remove EdgeState,
- existing BoardEdge PUT can materialize the same canonical Edge on another Board when both endpoints are represented.

### Application/API

Prove hidden-404 ordering for cross-Workspace/cross-Story addressing and `graph:update` authorization.

### Frontend unit/component

Prove:

- effective Edge fallback,
- whole-object properties replacement,
- normalization to null when equal canonical,
- scoped Inspector emits `update-edge-state`,
- unscoped Inspector still emits `update-edge`,
- shared `edge:<edgeId>` lane,
- first-edit inverse is all-null sparse state,
- Undo/Redo restores sparse state rather than canonical value,
- 409/failure keeps optimistic draft and exposes Retry.

### E2E acceptance

Create one canonical Edge ID represented on two Boards:

```text
Unscoped Board: Alice -- serves --> Crown
Scoped Board:   Alice -- rules  --> Crown
```

Acceptance flow:

1. create canonical Nodes + Edge on an unscoped Board,
2. create a Scope and scoped Board,
3. place the same canonical endpoint Nodes on the scoped Board,
4. use the existing idempotent BoardEdge PUT to represent the same canonical Edge on the scoped Board,
5. edit scoped relationship name to `rules`,
6. wait for Saved,
7. verify unscoped Board still shows canonical `serves`,
8. Undo scoped edit → effective `serves`,
9. Redo → `rules`,
10. reload scoped Board → `rules` persists,
11. verify history is empty after reload,
12. verify API snapshots use the same canonical Edge ID and keep canonical Edge + EdgeState separate.

Do not require Undo to survive reload; persistent history remains out of V1.

---

## 17. Explicit non-goals

This slice does not implement:

- Edge source/target overrides,
- relationship active/inactive or existence state,
- scoped creation/deletion of canonical Edges,
- iconKey override,
- Scope inheritance/hierarchy,
- live Board scope switching,
- Scope deletion,
- generic EntityState abstraction,
- persistent Undo/Redo history,
- realtime collaboration / CRDT,
- AI reasoning.

If relationship existence by Scope becomes a product requirement, design it explicitly as a later topology/lifecycle-state feature rather than overloading BoardEdge presence or silently adding an `active` flag here.

---

## 18. Architecture lock after this slice

After EdgeState V1:

```text
Story owns canonical Node / Edge identity + topology
Board owns presentation
Scope owns sparse NodeState / EdgeState content overrides
```

Effective graph content is derived at the frontend/application boundary:

```text
Effective Node = canonical Node + NodeState fallback
Effective Edge = canonical Edge + EdgeState fallback
```

Canonical and scoped state remain separately addressable for future AI reasoning, version history, and collaboration work.
