# EdgeState V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the implemented Scope state model from Nodes to Relationships so a scoped Board can override Edge `name`, `description`, and `properties` without mutating canonical Edge identity or topology.

**Architecture:** Preserve `Story owns canonical Node/Edge`, `Board = View`, and `Scope = State`. PostgreSQL stores sparse `(scopeId, edgeId)` EdgeState rows with NodeState-style optimistic locking; Board snapshots keep canonical `edges` and `edgeStates` separate. The frontend derives effective Edges, keeps optimistic EdgeState in Zustand, and persists scoped Relationship Inspector edits through the existing `edge:<edgeId>` Save Queue lane and session-local Undo/Redo.

**Tech Stack:** TypeScript 5.9, Next.js 16.3.3, React 19.2.8, Zustand 5.0.15, TanStack Query 5.102.3, React Flow 12.11.5, Zod 4.4.3, PostgreSQL, Drizzle ORM 0.45.2 / Drizzle Kit 0.31.10, Vitest 4.1.10, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-08-31-edge-state-v1-design.md`

## Global Constraints

- Canonical Edge identity, `sourceNodeId`, `targetNodeId`, `iconKey`, and relationship existence remain Story-owned canonical data.
- EdgeState V1 fields are exactly `name`, `description`, and `properties`.
- `null` EdgeState field means inherit the canonical value; non-null `properties` replaces the whole canonical properties object; no deep merge.
- BoardEdge remains presentation-only and must never hold scoped relationship truth.
- `(scopeId, edgeId)` may reference only a Scope and Edge from the same Story, enforced in PostgreSQL and application validation.
- `version=null` means create-if-absent; numeric version means compare-and-set; stale/missing expected versions return HTTP 409.
- Canonical Edge and EdgeState writes share the existing `edge:<edgeId>` Save Queue lane.
- Removing BoardEdge presentation never deletes EdgeState.
- Existing NodeState behavior, Board-removal Undo/Redo, hydration guard, invalid draft isolation, retry semantics, and unscoped Edge editing must remain unchanged.
- Do not introduce a generic polymorphic `entity_state` table or generic `effective-entity` frontend abstraction in this slice.
- Scope inheritance, Scope deletion, live Scope switching, scoped topology/existence, AI, realtime/CRDT, and persistent history remain excluded.
- Every task follows RED → GREEN → focused verification → commit.

---

## File Structure Lock

Create:

```text
src/app/api/v1/scopes/[scopeId]/edges/[edgeId]/state/route.ts
src/backend/modules/graph/application/put-edge-state/put-edge-state.ts
src/backend/modules/graph/application/edge-state.use-cases.test.ts
src/frontend/features/graph-editor/model/effective-edge.ts
src/frontend/features/graph-editor/model/effective-edge.test.ts
tests/e2e/scope-edge-state.spec.ts
```

Modify:

```text
src/backend/infrastructure/database/schema/graph.schema.ts
src/backend/modules/graph/domain/graph.ts
src/backend/modules/graph/domain/graph.repository.ts
src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts
src/backend/modules/graph/application/get-board-snapshot/get-board-snapshot.ts
src/contracts/graph/graph.contract.ts
src/app/api/v1/_shared/graph-http.ts
src/app/api/v1/boards/[boardId]/snapshot/route.ts
src/backend/infrastructure/openapi/openapi-document.ts
src/backend/infrastructure/openapi/openapi-document.test.ts
src/frontend/api/graph/graph.api.ts
src/frontend/api/graph/graph.queries.ts
src/frontend/features/graph-editor/model/editor-types.ts
src/frontend/features/graph-editor/store/graph-editor-store.ts
src/frontend/features/graph-editor/store/graph-editor-store.test.ts
src/frontend/features/graph-editor/commands/edge-commands.ts
src/frontend/features/graph-editor/commands/editor-command.ts
src/frontend/features/graph-editor/commands/editor-command-runtime.ts
src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
src/frontend/features/graph-editor/persistence/editor-persistence.ts
src/frontend/features/graph-editor/persistence/use-editor-persistence.ts
src/frontend/features/graph-editor/save-queue/editor-save-queue.ts
src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx
src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts
src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts
src/frontend/features/graph-editor/history/editor-history-entry.ts
src/frontend/features/graph-editor/history/editor-history-entry.test.ts
src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx
src/frontend/pages/graph-editor/graph-editor-page.tsx
src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
src/frontend/widgets/graph-editor/graph-canvas.tsx
src/frontend/widgets/graph-editor/graph-canvas.test.tsx
src/frontend/features/graph-editor/AGENTS.md
docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
```

Generated migration files:

```text
drizzle/0004_edge_state_v1.sql
drizzle/meta/0004_snapshot.json
drizzle/meta/_journal.json
```

---

### Task 1: Add EdgeState domain, contracts, and PostgreSQL integrity

**Files:**
- Modify: `src/backend/modules/graph/domain/graph.ts`
- Modify: `src/backend/modules/graph/domain/graph.repository.ts`
- Modify: `src/contracts/graph/graph.contract.ts`
- Modify: `src/backend/infrastructure/database/schema/graph.schema.ts`
- Test: `tests/integration/graph/graph-scope-node-state.integration.ts`
- Generate: `drizzle/0004_edge_state_v1.sql`, metadata

**Interfaces:**
- Produces domain `EdgeState`, `BoardSnapshot.edgeStates`.
- Produces `edgeStateResponseSchema`, `putEdgeStateRequestSchema`; extends `boardSnapshotResponseSchema` with `edgeStates`.
- Extends `GraphRepository` with `putEdgeState(...)`.

- [ ] **Step 1: Write the failing PostgreSQL integrity test**

Extend `tests/integration/graph/graph-scope-node-state.integration.ts` with cases proving same-Story EdgeState inserts succeed and cross-Story EdgeState inserts fail. Import `edgeState` before it exists so RED is structural.

```ts
await db.insert(scope).values({ id: scopeId, storyId: storyA.id, name: "Chapter 10" });
await db.insert(graphEdge).values(edge(storyB.id, edgeId, sourceB, targetB));
await expect(
  db.insert(edgeState).values({
    scopeId,
    edgeId,
    storyId: storyA.id,
    name: "rules",
    description: null,
    properties: null,
  }),
).rejects.toThrow();
```

- [ ] **Step 2: Run focused integration test and verify RED**

```bash
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
```

Expected: compile/import failure because `edgeState` / `EdgeState` do not exist.

- [ ] **Step 3: Add domain and repository types**

Add:

```ts
export interface EdgeState {
  scopeId: string;
  edgeId: string;
  name: string | null;
  description: string | null;
  properties: JsonObject | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Extend `BoardSnapshot` with `edgeStates: EdgeState[]`.

Extend `GraphRepository`:

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

- [ ] **Step 4: Add Zod contracts**

```ts
export const putEdgeStateRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  version: z.number().int().min(1).nullable(),
  name: nameSchema.nullable(),
  description: descriptionSchema.nullable(),
  properties: jsonObjectSchema.nullable(),
});

export const edgeStateResponseSchema = z.object({
  scopeId: graphIdSchema,
  edgeId: graphIdSchema,
  name: z.string().nullable(),
  description: z.string().nullable(),
  properties: jsonObjectSchema.nullable(),
  version: z.number().int().min(1),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});
```

Extend snapshot schema with `edgeStates: z.array(edgeStateResponseSchema)` and export inferred types.

- [ ] **Step 5: Add Drizzle `edge_state` table**

Use primary key `(scopeId, edgeId)`, `storyId`, nullable overrides, version default 1, timestamps, story/edge indexes, and composite FKs:

```ts
foreignKey({
  name: "edge_state_scope_story_fk",
  columns: [table.scopeId, table.storyId],
  foreignColumns: [scope.id, scope.storyId],
}).onDelete("cascade");

foreignKey({
  name: "edge_state_edge_story_fk",
  columns: [table.edgeId, table.storyId],
  foreignColumns: [graphEdge.id, graphEdge.storyId],
}).onDelete("cascade");
```

- [ ] **Step 6: Generate/check migration**

```bash
pnpm db:generate -- --name edge_state_v1
pnpm db:check
```

Inspect generated SQL: only create `edge_state` plus constraints/indexes; no destructive Board/Edge backfill.

- [ ] **Step 7: GREEN verification**

```bash
pnpm db:migrate
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts
pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add src/backend/modules/graph/domain src/backend/infrastructure/database/schema/graph.schema.ts src/contracts/graph/graph.contract.ts tests/integration/graph/graph-scope-node-state.integration.ts drizzle
git commit -m "feat: add edge state schema"
```

---

### Task 2: Implement EdgeState CAS repository, use-case, API, snapshot, and OpenAPI

**Files:**
- Create: `src/backend/modules/graph/application/put-edge-state/put-edge-state.ts`
- Create/Test: `src/backend/modules/graph/application/edge-state.use-cases.test.ts`
- Create: `src/app/api/v1/scopes/[scopeId]/edges/[edgeId]/state/route.ts`
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Modify: `src/backend/modules/graph/application/get-board-snapshot/get-board-snapshot.ts`
- Modify: `src/app/api/v1/_shared/graph-http.ts`
- Modify: `src/app/api/v1/boards/[boardId]/snapshot/route.ts`
- Modify/Test: `src/backend/infrastructure/openapi/openapi-document.ts`, `openapi-document.test.ts`
- Test: `tests/integration/graph/graph-scope-node-state.integration.ts`, `graph-api.integration.ts`

**Interfaces:**
- Consumes `EdgeState` and `GraphRepository.putEdgeState`.
- Produces durable `PUT /api/v1/scopes/:scopeId/edges/:edgeId/state` and scoped snapshot `edgeStates`.

- [ ] **Step 1: Write failing application tests**

Create `edge-state.use-cases.test.ts` proving:
1. cross-Story Edge returns hidden 404 before capability call,
2. stale repository result `"conflict"` maps to 409,
3. valid request calls repository with complete sparse overrides.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/backend/modules/graph/application/edge-state.use-cases.test.ts
```

Expected: `putEdgeState` module missing.

- [ ] **Step 3: Implement `putEdgeState` use-case**

Mirror NodeState isolation order exactly: Scope → Story/workspace → Edge/same Story → `graph:update` → repository CAS. Messages: `Scope not found`, `Edge not found`, `EdgeState version conflict`.

- [ ] **Step 4: Add repository CAS**

For `expectedVersion === null`, insert only if absent; conflict on duplicate `(scopeId,edgeId)`. For numeric version, update matching row and increment version once. Resolve Story from Scope/Edge and return `null` for invalid same-Story inputs. Never update canonical `graph_edge`.

- [ ] **Step 5: Extend snapshot read**

When Board `scopeId` is null, return `edgeStates: []`. When scoped, fetch EdgeState rows only where `edgeId` is in represented `boardEdges`; do not fetch state for hidden/unrepresented canonical Edges.

- [ ] **Step 6: Add serializer and HTTP route**

Add `toEdgeStateResponse`. Route validates UUID params/body, requires actor, calls use-case, parses `edgeStateResponseSchema`, and delegates errors to `routeErrorResponse`.

- [ ] **Step 7: Add OpenAPI**

Register EdgeState request/response schemas and PUT path; extend snapshot schema documentation with `edgeStates`.

- [ ] **Step 8: Add integration tests**

Prove:
- first write creates version 1,
- retry with `version:null` conflicts,
- numeric update produces version 2,
- stale numeric version conflicts,
- scoped snapshot returns only represented EdgeState,
- unscoped snapshot returns `edgeStates: []`.

- [ ] **Step 9: GREEN verification and commit**

```bash
pnpm test -- src/backend/modules/graph/application/edge-state.use-cases.test.ts src/backend/infrastructure/openapi/openapi-document.test.ts
pnpm test:integration -- tests/integration/graph/graph-scope-node-state.integration.ts tests/integration/graph/graph-api.integration.ts
pnpm typecheck
git add src/app/api/v1 src/backend src/contracts tests/integration
git commit -m "feat: add edge state api"
```

---

### Task 3: Add effective Edge model and optimistic Zustand EdgeState

**Files:**
- Create/Test: `src/frontend/features/graph-editor/model/effective-edge.ts`, `effective-edge.test.ts`
- Modify: `src/frontend/features/graph-editor/model/editor-types.ts`
- Modify/Test: `src/frontend/features/graph-editor/store/graph-editor-store.ts`, `graph-editor-store.test.ts`

**Interfaces:**
- Produces `EditorEdgeState`, `findEdgeState`, `resolveEffectiveEdge`, `normalizeEdgeStateOverrides` and `replaceEdgeState`.

- [ ] **Step 1: Write pure-model RED tests**

```ts
expect(resolveEffectiveEdge(canonical, {
  scopeId, edgeId,
  name: "rules",
  description: null,
  properties: null,
  version: 1,
  createdAt,
  updatedAt,
}).name).toBe("rules");
```

Also prove canonical `sourceNodeId`, `targetNodeId`, `iconKey` are unchanged and canonical properties are inherited when state properties are null. Prove normalization maps effective values equal to canonical back to null.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/model/effective-edge.test.ts
```

- [ ] **Step 3: Implement pure helper**

Create `EditorEdgeState` with nullable version/timestamps for optimistic first writes, identical semantics to `EditorNodeState` but keyed by `edgeId`.

- [ ] **Step 4: Write store RED test**

Hydrate snapshot with persisted EdgeState; assert lookup/replace preserves canonical `edges`. Replace with optimistic `{version:null}` and assert only `edgeStates` changes.

- [ ] **Step 5: Extend editor state/store**

Add `edgeStates`, normalize absent legacy fixture field to `[]`, and add identity replacement by `(scopeId,edgeId)`.

- [ ] **Step 6: GREEN verification and commit**

```bash
pnpm test -- src/frontend/features/graph-editor/model/effective-edge.test.ts src/frontend/features/graph-editor/store/graph-editor-store.test.ts
pnpm typecheck
git add src/frontend/features/graph-editor/model src/frontend/features/graph-editor/store
git commit -m "feat: add effective edge state"
```

---

### Task 4: Add `update-edge-state` command, persistence, and Save Queue lane

**Files:**
- Modify: `src/frontend/features/graph-editor/commands/edge-commands.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command.ts`
- Modify/Test: `editor-command-runtime.ts`, `editor-command-runtime.test.ts`
- Modify: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Modify: `src/frontend/api/graph/graph.api.ts`, `graph.queries.ts`
- Modify: `src/frontend/features/graph-editor/save-queue/editor-save-queue.ts`
- Modify/Test: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx`

**Interfaces:**
- Produces `UpdateEdgeStateCommand`:

```ts
type UpdateEdgeStateCommand = {
  type: "update-edge-state";
  boardId: string;
  workspaceId: string;
  scopeId: string;
  edgeId: string;
  version: number | null;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown> | null;
};
```

- [ ] **Step 1: Write runtime RED tests**

Prove local apply inserts/replaces optimistic EdgeState and leaves canonical Edge unchanged. Prove reconcile from server advances version/timestamps but preserves a newer local override if another edit occurred while request was in flight.

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
```

Expected: command not assignable to `EditorCommand`.

- [ ] **Step 3: Register command and runtime**

Apply sparse state locally with command version/timestamps preserved from existing state where available. Persistence reconciliation must use identity `(scopeId,edgeId)` and must not replace current override fields with stale response values after a newer local edit.

- [ ] **Step 4: Add API/query mutation and persistence**

Add frontend `putEdgeState(scopeId, edgeId, request)` and mutation/cache helper that updates only `snapshot.edgeStates`; do not mutate `snapshot.edges`.

- [ ] **Step 5: Add Save Queue lane**

Return `edge:${command.edgeId}` for `update-edge-state`, same as `update-edge`, remove/restore BoardEdge. Existing per-lane version preparation must replace queued `version:null` or stale version with the latest persisted version after an earlier same-lane write completes.

- [ ] **Step 6: Update persistence fixtures**

Every `EditorPersistence` test mock must define `updateEdgeState`; do not weaken the interface to optional.

- [ ] **Step 7: GREEN verification and commit**

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx
pnpm typecheck
git add src/frontend/api src/frontend/features/graph-editor
git commit -m "feat: persist scoped edge state"
```

---

### Task 5: Make Relationship rendering and Inspector scope-aware

**Files:**
- Modify/Test: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts`, `.test.ts`
- Modify/Test: `src/frontend/pages/graph-editor/graph-editor-page.tsx`, `graph-editor-inspector.test.tsx`
- Modify/Test: `src/frontend/widgets/graph-editor/graph-canvas.tsx`, `graph-canvas.test.tsx`

**Interfaces:**
- Consumes `resolveEffectiveEdge` and `normalizeEdgeStateOverrides`.
- Scoped Relationship Inspector dispatches `update-edge-state`; unscoped continues `update-edge`.

- [ ] **Step 1: Write autosave RED test**

On scoped store with canonical Edge `serves` and EdgeState `rules`, draft from `rules` → `commands` must dispatch:

```ts
{
  type: "update-edge-state",
  scopeId,
  edgeId,
  version: 1,
  name: "commands",
  description: null,
  properties: null,
}
```

An unscoped store must still dispatch `update-edge` with canonical Edge version.

- [ ] **Step 2: Write page/canvas RED tests**

Scoped snapshot must render relationship label `rules` and Inspector draft `rules`; canonical `serves` must not be shown as selected Relationship content. Unscoped snapshot remains `serves`.

- [ ] **Step 3: Verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx src/frontend/widgets/graph-editor/graph-canvas.test.tsx
```

- [ ] **Step 4: Implement effective Relationship projection**

In page selection, dirty-draft scan, canvasEdges, and replay draft replacement, resolve EdgeState when `state.scope` exists. Do not alter edge endpoints.

- [ ] **Step 5: Implement scoped autosave**

Evaluate draft against effective Edge; normalize sparse fields against canonical Edge; dispatch `update-edge-state`. Invalid drafts stay outside Save Queue exactly as before.

- [ ] **Step 6: Include EdgeState in selected failure detection**

Inspector error lane treats `update-edge-state` as an Inspector save failure, maps 409 to the existing conflict/retry UX, and does not surface it as unrelated action failure.

- [ ] **Step 7: GREEN verification and commit**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx src/frontend/widgets/graph-editor/graph-canvas.test.tsx
pnpm typecheck
git add src/frontend/features/graph-editor/inspector src/frontend/pages/graph-editor src/frontend/widgets/graph-editor
git commit -m "feat: edit scoped relationship state"
```

---

### Task 6: Add EdgeState Undo/Redo including pending first-write Undo

**Files:**
- Modify/Test: `src/frontend/features/graph-editor/history/editor-history-entry.ts`, `.test.ts`
- Modify/Test: `src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`

**Interfaces:**
- `update-edge-state` is undoable and coalesces by `scopeId + edgeId` only.
- Inverse stores prior sparse override, never resolved effective values.

- [ ] **Step 1: Write history RED tests**

Case A: persisted prior state `{name:"rules", description:null, properties:null, version:3}` edited to `commands`; inverse must restore `rules` with version derived at persistence time.

Case B: no prior EdgeState row; first edit inverse must be exactly:

```ts
{
  type: "update-edge-state",
  scopeId,
  edgeId,
  version: null,
  name: null,
  description: null,
  properties: null,
  ...identity
}
```

- [ ] **Step 2: Verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/history/editor-history-entry.test.ts
```

- [ ] **Step 3: Implement history entry/inverse**

Make state edit undoable; use `(scopeId,edgeId)` coalesce key so canonical `update-edge` and scoped `update-edge-state` never coalesce with each other.

- [ ] **Step 4: Write pending-first-write queue test**

Hold first EdgeState persistence promise. Dispatch first edit, then Undo while lane is saving. Assert local effective relationship immediately returns to canonical/inherited value. Resolve first PUT as version 1; assert queued Undo PUT uses version 1 and all-null overrides, resulting server version 2.

- [ ] **Step 5: Implement/adjust lane version preparation only if RED proves necessary**

Do not add a new queue mechanism if existing NodeState same-lane preparation already generalizes; extend the existing condition to `update-edge-state` only if required.

- [ ] **Step 6: Ensure replay replaces Relationship draft with effective Edge**

Undo/Redo replay must keep Inspector draft synchronized with effective EdgeState while leaving persistent history excluded after reload.

- [ ] **Step 7: GREEN verification and commit**

```bash
pnpm test -- src/frontend/features/graph-editor/history/editor-history-entry.test.ts src/frontend/features/graph-editor/history/editor-history-save-queue.test.tsx src/frontend/pages/graph-editor/graph-editor-history.test.tsx
pnpm typecheck
git add src/frontend/features/graph-editor/history src/frontend/pages/graph-editor
git commit -m "feat: undo scoped relationship edits"
```

---

### Task 7: Add browser acceptance for canonical/scoped Edge isolation

**Files:**
- Create: `tests/e2e/scope-edge-state.spec.ts`
- Reuse: existing `PUT /api/v1/boards/:boardId/edges/:edgeId` restore/materialization endpoint

**Interfaces:**
- Proves one canonical Edge ID is represented on an unscoped and scoped Board, with state isolated by Scope.

- [ ] **Step 1: Write failing E2E flow**

Create Story, Scope, unscoped Board, scoped Board, canonical Alice/Crown nodes and one canonical Edge `serves` on the base Board. Place the same nodes on scoped Board, then call existing BoardEdge PUT to materialize the same `edgeId` there. Open scoped Board UI and edit Relationship to `rules`.

Acceptance order:

```text
base Board → canonical "serves"
scoped Board → edit to "rules"
Undo → "serves"
Redo → "rules"
reload scoped Board → "rules"
open/reload base Board → still "serves"
API snapshots → same canonical edgeId; only scoped snapshot has EdgeState
```

Do not expect Undo after reload; history remains session-local.

- [ ] **Step 2: Run E2E and verify RED before any missing production fix**

```bash
pnpm e2e -- tests/e2e/scope-edge-state.spec.ts
```

- [ ] **Step 3: Make only acceptance-required fixes inside approved EdgeState scope**

Do not add topology state or a new place-existing-edge endpoint. If same Edge materialization fails, fix the existing restore/materialization semantics only if it violates the already-approved idempotent contract.

- [ ] **Step 4: GREEN verification and commit**

```bash
pnpm e2e -- tests/e2e/scope-edge-state.spec.ts
git add tests/e2e/scope-edge-state.spec.ts
git commit -m "test: cover scoped relationship state"
```

---

### Task 8: Lock architecture docs and perform full verification

**Files:**
- Modify: `src/frontend/features/graph-editor/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`
- Keep: `docs/superpowers/specs/2026-08-31-edge-state-v1-design.md`
- Keep: `docs/superpowers/plans/2026-08-31-edge-state-v1.md`

- [ ] **Step 1: Update local Editor invariants**

Record that scoped Node edits persist NodeState, scoped Relationship edits persist EdgeState, canonical and scoped writes share entity lanes, Board removal never deletes state, and topology remains canonical.

- [ ] **Step 2: Update parent architecture from future EdgeState to implemented EdgeState V1**

Keep relationship existence/topology state, inheritance, AI/realtime, and persistent history explicitly deferred.

- [ ] **Step 3: Run complete verification**

```bash
pnpm db:check
pnpm check
pnpm test:integration
pnpm build
git diff --exit-code
pnpm e2e
```

Expected: architecture/lint/typecheck/unit all pass, PostgreSQL integration all pass, production build passes, build leaves tracked files clean, all Playwright tests pass including `scope-edge-state.spec.ts`.

- [ ] **Step 4: Review exact PR diff**

Confirm no canonical Edge topology mutation was introduced, no BoardEdge scoped fields were added, `edgeStates` is separate from `edges`, and no unrelated refactor/generic abstraction entered the diff.

- [ ] **Step 5: Commit docs**

```bash
git add src/frontend/features/graph-editor/AGENTS.md docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md docs/superpowers/specs/2026-08-31-edge-state-v1-design.md docs/superpowers/plans/2026-08-31-edge-state-v1.md
git commit -m "docs: lock edge state architecture"
```

- [ ] **Step 6: Merge gate**

Before merge, require fresh CI on the exact PR head, `mergeable=true`, no unresolved review threads, and merge with `expected_head_sha`. If the PR remains draft, mark ready; if the connector has the same ready-for-review compatibility failure seen on PR #19, create a non-draft mirror branch at the identical SHA rather than modifying production content.
