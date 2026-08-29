# Editor Save Queue Design

Status: Approved design for implementation planning
Date: 2026-08-29

## 1. Context

The Graph Editor now represents all current write paths as plain `EditorCommand` values and routes durable writes through a mockable `EditorPersistence` boundary. The next architecture gap is the missing Save Queue between immediate editor working-state changes and persistence.

The repository architecture already defines the editor flow as:

```text
User action
  → Zustand immediately
  → Command/Operation
  → Save Queue
  → TanStack Mutation / HTTP
  → API
  → PostgreSQL
```

The handoff requires visible `Saving / Saved / Unsaved / Error` state, coalescing of not-yet-started Node moves, entity-local ordering such as `Create Node → Move Node`, preservation of local working state on network failure, and bounded/manual retry behavior.

## 2. Goals

This slice will:

1. Add a generic editor Save Queue between local command application and `EditorPersistence`.
2. Keep user-visible working state responsive: local state changes happen before durable persistence waits.
3. Serialize commands that target the same canonical/presentation entity while allowing unrelated entity lanes to progress independently.
4. Coalesce pending, not-yet-started `move-node` commands for the same Node to the latest position.
5. Expose aggregate save state:
   - `saved`
   - `saving`
   - `unsaved`
   - `error`
6. Keep local working state intact when persistence fails.
7. Stop a failed entity lane until the user explicitly retries; do not perform unbounded automatic retries.
8. Prevent stale persistence responses from overwriting newer local working state.
9. Preserve the existing frontend/backend HTTP boundary, Board/View distinction, and Story-owned canonical Node/Edge model.

## 3. Non-goals

This slice does not implement:

- Inspector typing autosave or debounce.
- Removal of the current explicit Inspector Save buttons.
- Invalid intermediate JSON draft handling for Inspector properties.
- Undo/redo or inverse commands.
- Realtime collaboration, WebSocket persistence, Yjs/CRDT, event sourcing, or DB transaction-history undo.
- A global distributed job queue.
- New backend endpoints, schema changes, migrations, or canonical delete semantics.
- General cross-entity dependency scheduling. This slice guarantees entity-local ordering and one concrete Node-create→Edge-create dependency rule; broader dependency modeling remains deferred.

## 4. State ownership

State ownership remains unchanged:

- PostgreSQL: durable persisted truth.
- TanStack Query: fetched server state, cache synchronization, and mutation lifecycle.
- Zustand: current Graph Editor working state.
- React Flow: rendering/input engine only.
- Save Queue: pending durable operations and save-progress/error metadata only.

The Save Queue must not become a second copy of graph state. Commands contain the data needed to persist a change; the current graph itself stays in Zustand.

## 5. Save Queue model

### Save state

```ts
type SaveState = "saved" | "saving" | "unsaved" | "error";
```

Aggregate state priority:

```text
any failed operation/lane  → error
else any running operation → saving
else any pending operation → unsaved
else                       → saved
```

This state is shown in the Board Editor header. When state is `error`, the UI also exposes `Retry`.

### Entity lanes

Each queued command belongs to one serialization lane:

```text
node:<nodeId>
edge:<edgeId>
```

All Node commands targeting the same Node share one lane:

- create-node
- move-node
- update-node
- remove-board-node

All Edge commands targeting the same Edge share one lane:

- create-edge
- update-edge
- remove-board-edge

Within a lane, durable persistence is strictly ordered. Different lanes may persist independently.

This guarantees the required case:

```text
Create Node
→ Move Node
```

The Move cannot reach persistence before the Create for the same Node has completed durably.

### Narrow Node-create → Edge-create dependency

A concrete existing workflow adds one cross-lane dependency without introducing a general scheduler:

```text
Create Node A (still active)
Create Relationship A → B
```

A queued `create-edge` captures any still-active `create-node` operation for its source and target Node IDs at enqueue time and waits until those captured creates have completed durably. If an endpoint create fails, the Edge remains blocked until that create is explicitly retried and succeeds.

This rule exists to prevent the Relationship POST from outrunning the endpoint Node POST and violating backend foreign-key requirements. It is intentionally limited to `create-edge` depending on active source/target `create-node`; later Node operations, unrelated lanes, and arbitrary cross-entity dependency graphs are not modeled.

## 6. Command lifecycle

The current `executeEditorCommand()` combines local optimistic transition, durable persistence, reconcile, and rollback. The Save Queue requires those responsibilities to be separated so persistence latency never delays local editor response.

The runtime will expose two phases:

```text
apply local command
→ enqueue durable command
→ persist later
→ reconcile durable response if still current
```

The exact function names may be refined during implementation, but responsibilities must remain explicit:

### Local phase

- Applies the user's desired working-state transition immediately to Zustand.
- Never calls Axios/TanStack mutation hooks.
- Produces enough metadata to reconcile a matching persistence response safely.
- Does not roll back the user's desired working state merely because the network failed.

### Durable phase

- Calls `EditorPersistence` for the command.
- Runs only when that command reaches the front of its entity lane.
- On success, reconciles server-owned fields such as returned versions/timestamps without overwriting newer working edits.
- On failure, leaves the working state intact and marks the lane failed.

The page remains responsible for constructing commands and showing user-facing validation/conflict messages where those are truly form-level concerns. Queue/save-state behavior belongs to the Graph Editor subsystem, not the page.

## 7. Move coalescing

Only pending, not-yet-started `move-node` commands may be coalesced.

Example:

```text
move node A → x=100  (currently running)
move node A → x=120  (pending)
move node A → x=180  (pending)
```

Queue result:

```text
running: move A → x=100
pending: move A → x=180
```

The already-running operation is never mutated. The latest pending position replaces the older pending position for the same Node lane.

Coalescing does not apply across command types. For example, `update-node` must not be silently absorbed into `move-node`, and create/remove ordering must remain explicit.

## 8. Failure and retry

Persistence failure behavior:

```text
network/server failure
→ keep Zustand working state
→ keep failed operation in queue/lane
→ aggregate SaveState = error
→ stop that lane
→ show Retry
```

Unrelated lanes may continue processing.

Retry behavior:

- `Retry` explicitly re-arms failed lanes/operations.
- The failed operation is attempted again before later operations in the same lane.
- Automatic infinite retry is forbidden.
- This slice does not add exponential backoff or background retry loops.

For optimistic-locking `409` errors, the queue records failure and preserves local working state. Existing conflict-specific user messaging should remain available; conflict resolution/merge UX is not added in this slice.

## 9. Stale reconcile protection

A persistence response must not overwrite a newer local edit.

Example:

```text
1. local Node A moves to x=100
2. move x=100 starts persisting
3. before response, local Node A moves to x=180
4. server responds with persisted x=100
```

The response may update persistence metadata if appropriate, but it must not move the working Node back to x=100. The pending x=180 command remains authoritative for the current editor working position.

Implementation may use a per-command operation ID, local revision/token, or explicit "is this still the latest working value?" comparison. The mechanism is internal; the observable rule is mandatory.

## 10. UI behavior

The Board Editor shows a compact save indicator:

```text
Saved
Saving…
Unsaved
Error · Retry
```

This indicator reflects the generic Save Queue, not individual TanStack mutation `isPending` flags.

Existing inline errors that are specific to an action/form may remain for this slice, but the queue's aggregate `Error` state must also become visible.

Inspector remains explicit-save in this slice. The next slice will move Inspector drafts toward:

```text
edit draft
→ debounce
→ command
→ Save Queue
```

## 11. Proposed source structure

```text
src/frontend/features/graph-editor/
├─ commands/
├─ persistence/
├─ save-queue/
│  ├─ editor-save-queue.ts
│  ├─ editor-save-queue.test.ts
│  ├─ save-state.ts
│  └─ use-editor-save-queue.ts
├─ store/
└─ model/
```

Implementation should keep the queue core framework-independent and unit-testable. React hooks adapt it to component lifecycle; TanStack mutations remain behind `EditorPersistence`.

If separating the existing command executor requires a small command-runtime module, it stays under `commands/` or `save-queue/` and must not import React Flow, Axios, backend, Drizzle, or database modules.

## 12. Testing strategy

### Unit tests

The queue core must cover at least:

1. `saved → unsaved → saving → saved` state transitions.
2. `error` state on persistence failure.
3. failed lane preserves working state.
4. manual Retry resumes the failed operation.
5. same-Node pending Move commands coalesce to the latest value.
6. an already-running Move is never replaced.
7. `Create Node → Move Node` persistence ordering for the same Node.
8. unrelated Node/Edge lanes are not blocked by another lane's failure.
9. `create-edge` waits for still-active source/target `create-node` operations.
10. stale persistence response cannot overwrite newer local working position.
11. create/update/remove paths continue to preserve Board-vs-canonical ownership rules.

### Frontend regression tests

Existing Graph Editor component tests must continue to verify:

- create Node/Edge behavior,
- move persistence,
- Inspector canonical updates and 409 handling,
- Board-only removal semantics,
- same-Board snapshot hydration guard.

Add save-indicator tests for `Saved`, `Saving…`, `Unsaved`, and `Error · Retry` as appropriate.

### Full verification

Before integration:

- AGENTS validation
- import-boundary validation
- ESLint
- TypeScript
- all unit tests
- PostgreSQL integration tests
- production build
- tracked-file clean-tree check
- Playwright critical Editor flows

E2E should retain the `edit → saved → reload → verify` pattern.

## 13. Architecture documentation changes

Because this slice introduces the concrete Save Queue subsystem, update the approved Story Graph architecture document only where needed to record:

- entity-lane serialization,
- pending Move coalescing,
- the narrow endpoint Node-create→Edge-create dependency,
- visible four-state save indicator,
- failed-lane/manual-retry behavior,
- stale reconcile protection.

`AGENTS.md` invariants do not require semantic changes unless implementation discovers a new repository-wide rule. The existing Graph Editor instruction already requires command/operation-shaped changes and Zustand ownership of working state.

## 14. Acceptance criteria

The slice is complete when:

- all editor durable writes are routed through the Save Queue,
- local working changes remain immediate,
- same-entity persistence is ordered,
- pending same-Node moves coalesce,
- `create-edge` cannot outrun an active source/target `create-node`,
- network failure does not snap working state back,
- Retry can resume failed persistence without an infinite retry loop,
- stale durable responses cannot overwrite newer working state,
- the editor visibly reports `Saved / Saving / Unsaved / Error`,
- existing Board/View and canonical Story ownership invariants remain intact,
- Inspector autosave, undo/redo, and collaboration remain deferred,
- full CI-equivalent verification passes on the exact feature head.
