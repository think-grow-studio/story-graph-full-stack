# Editor Undo/Redo V1 Design

Status: Approved for implementation
Date: 2026-08-30
Parent architecture: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`

## 1. Goal

Add command-based Undo/Redo to the Graph Editor without changing the existing persistence model: PostgreSQL remains durable truth, Zustand remains editor working state, Save Queue remains the only durable write scheduler, and Undo/Redo is expressed as new forward/inverse editor commands rather than database rollback.

V1 intentionally supports only editor mutations that already have an exact durable inverse with the current API surface:

- `move-node`
- `update-node`
- `update-edge`

The following existing commands are not undoable in this slice because the backend does not yet expose the exact inverse operation:

- `create-node` would require canonical Node deletion.
- `create-edge` would require canonical Edge deletion.
- `remove-board-node` would require re-attaching the previous BoardNode and incident BoardEdges.
- `remove-board-edge` would require re-attaching the previous BoardEdge.

Unsupported commands still terminate text coalescing and invalidate the redo branch.

## 2. Core invariants

1. History is Board-editor-session memory only. It is not persisted to PostgreSQL, localStorage, IndexedDB, or TanStack Query.
2. History stores semantic command pairs, not full Zustand snapshots.
3. Every undoable user edit records `{ forward, inverse }` before the forward command mutates Zustand.
4. Undo dispatches `inverse` through the existing Save Queue; Redo dispatches `forward` through the same Save Queue.
5. Undo/Redo commands are never recursively recorded as new history entries.
6. Save Queue remains responsible for per-entity ordering, retry, and durable execution. History never talks to HTTP, TanStack Query, Axios, or backend modules.
7. Canonical Node/Edge optimistic-lock versions stored in old history entries are not authoritative. The existing command runtime re-resolves the latest current Zustand version immediately before persistence.
8. A running/pending durable write does not block Undo. Same-lane Save Queue ordering guarantees that the inverse is persisted after the forward write.
9. A failed Save Queue lane or `409 Conflict` disables new editor-level Undo/Redo until the existing explicit Retry path restores durable ordering.
10. Dirty or invalid Inspector raw draft disables editor-level Undo/Redo. Native text-field undo remains available while an input is focused.
11. History is reset when the mounted Board changes.
12. History capacity is capped at 100 undo entries. Dropping an oldest entry never changes current editor state.
13. Any new normal user edit after Undo clears the redo stack, including unsupported create/remove commands.

## 3. Architecture

Current edit flow:

```text
User action
  -> Save Queue dispatch
     -> applyEditorCommand(Zustand)
     -> enqueue durable operation
     -> API
     -> PostgreSQL
```

Undo/Redo V1 inserts a History Dispatcher in front of Save Queue:

```text
User action
  -> History Dispatcher
     -> derive inverse from current Zustand
     -> record/coalesce HistoryEntry
     -> Save Queue dispatch(forward)
        -> applyEditorCommand(Zustand)
        -> enqueue durable operation
        -> API
        -> PostgreSQL
```

Undo:

```text
Undo
  -> pop undo entry
  -> Save Queue dispatch(entry.inverse)
  -> move entry to redo stack
```

Redo:

```text
Redo
  -> pop redo entry
  -> Save Queue dispatch(entry.forward)
  -> move entry to undo stack
```

The subsystem lives under:

```text
src/frontend/features/graph-editor/history/
├─ editor-history-entry.ts
├─ editor-history-entry.test.ts
├─ editor-history.ts
├─ editor-history.test.ts
├─ use-editor-history.ts
└─ use-editor-history.test.tsx
```

Responsibilities:

- `editor-history-entry.ts`: derive exact inverse commands from current GraphEditorStore plus the incoming supported command; no mutable history state.
- `editor-history.ts`: framework-independent undo/redo stacks, capacity, coalescing, redo invalidation, and snapshots.
- `use-editor-history.ts`: Board-scoped React adapter that connects history with existing Save Queue dispatch and exposes normal dispatch/undo/redo.
- `GraphEditorPage`: composition, UI enable/disable rules, drag-start capture, keyboard shortcut wiring.
- `GraphCanvas`: expose drag-start callback; no history logic.

`editor-save-queue.ts` must not acquire history responsibilities.

## 4. History entry model

```ts
export type UndoableEditorCommand =
  | MoveNodeCommand
  | UpdateNodeCommand
  | UpdateEdgeCommand;

export type EditorHistoryEntry = {
  forward: UndoableEditorCommand;
  inverse: UndoableEditorCommand;
  coalescingKey: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};
```

The inverse is derived before local application of the forward command.

### Move Node

For a move, the normal drag flow has already updated Zustand frame-by-frame before drag stop, so the pre-drag location cannot be derived at dispatch time. `GraphCanvas` therefore reports `onNodeDragStart(nodeId)`, and the page captures the BoardNode position before drag mutation begins.

Example:

```text
start (100, 100)
stop  (500, 300)

forward = move-node (500, 300)
inverse = move-node (100, 100)
```

One completed drag gesture is exactly one history entry. Drag frames are never history entries.

If drag start and drag stop positions are equal, no history entry or persistence command is produced.

### Update Node

Before dispatch, resolve the current Node from Zustand.

```text
current: name=Alice, description=A
forward: name=Alicia, description=B
inverse: name=Alice, description=A
```

The inverse copies canonical editable values from the current Node: `name`, `description`, and `properties`. `iconKey` remains outside the current Inspector command surface and is unchanged.

### Update Edge

Identical to Update Node using the current canonical Edge values.

If the referenced canonical entity is missing, the supported forward command is not dispatched and no history entry is recorded.

## 5. Text edit coalescing

Inspector autosave may emit more than one `update-node` / `update-edge` command during one continuous editing session. History should treat continuous edits to the same entity as one semantic Undo unit.

Coalescing key:

```text
update-node:<nodeId>
update-edge:<edgeId>
```

Coalescing occurs only when all are true:

1. the newest undo entry has the same coalescing key,
2. the new command is the same update command kind and same entity,
3. no explicit history boundary occurred since the previous entry,
4. the new command arrives within 2,000 ms of the previous coalesced update.

When coalescing:

- preserve the oldest `inverse`,
- replace `forward` with the newest forward command,
- update `updatedAtMs`,
- do not create another undo entry.

Example:

```text
Alice -> Alic -> Alicia -> Alicia V.
```

within one continuous edit becomes:

```text
inverse = Alice
forward = Alicia V.
```

Undo/Redo, selecting another entity, a move, an unsupported create/remove command, or a 2,000 ms quiet period starts a new text history entry.

The 500 ms Inspector persistence debounce remains unchanged. Coalescing is a history concern layered above durable operation scheduling.

## 6. Redo invalidation and unsupported commands

Standard branch semantics apply:

```text
A -> B -> C
Undo => B
new edit => D
```

After `D`, the old redo path to `C` is deleted.

Every normal user command clears redo before it is dispatched, even when the command itself is not undoable. This includes `create-node`, `create-edge`, `remove-board-node`, and `remove-board-edge`.

Unsupported commands are not added to the undo stack. They also call a history boundary so a later text update cannot coalesce across them.

## 7. Save Queue, failure, and optimistic locking semantics

Undo while a forward write is pending/running is allowed.

Example:

```text
update-node Alicia  (running)
undo -> update-node Alice (pending same node lane)
```

Save Queue serializes both on `node:<id>`, so PostgreSQL reaches the same logical order as Zustand.

The existing runtime re-resolves the latest canonical `version` immediately before `update-node` / `update-edge` persistence. History versions are therefore only command-shape values and are never treated as durable CAS truth.

If a lane is in `error`, including a 409 conflict:

- toolbar Undo and Redo are disabled,
- keyboard editor Undo/Redo is ignored,
- the existing header `Error · Retry` remains the recovery path,
- no automatic conflict merge or automatic retry is introduced.

If an Undo/Redo command itself fails after its local optimistic application:

- the local working state remains at the Undo/Redo result,
- the corresponding history stack movement remains in place,
- Save Queue reports `Error`,
- Retry re-runs the exact failed inverse/forward operation,
- no history entry is duplicated.

## 8. Inspector draft interaction

Raw Inspector draft remains separate from canonical graph history.

If any Inspector draft is dirty, invalid, or otherwise unsaved:

- editor-level toolbar Undo/Redo is disabled,
- canvas/global keyboard Undo/Redo is disabled,
- text inputs remain editable,
- browser/native input undo remains available when an editable input has focus.

Once a valid Inspector draft passes the existing 500 ms debounce and emits an update command, the History Dispatcher records/coalesces the canonical update.

Undo/Redo of a canonical Node/Edge update must also keep the visible Inspector draft synchronized with the resulting canonical command values when that entity has an existing draft. Otherwise the autosave controller would immediately reinterpret the pre-Undo raw draft as a new edit and reapply it.

Therefore the React history adapter receives an optional callback invoked after local Undo/Redo dispatch:

```ts
onReplayCommand(command: UndoableEditorCommand): void;
```

`GraphEditorPage` uses it for update-node/update-edge to replace the matching raw draft fields with the replayed canonical `name`, `description`, and pretty-printed `properties` while preserving draft-store revision semantics. Move commands do not touch Inspector drafts.

Normal forward Inspector typing continues to own its raw draft and must not be rewritten by normal persistence responses.

## 9. UI and keyboard behavior

Add `Undo` and `Redo` controls to the editor header near the save indicator.

Buttons:

- `Undo` disabled when undo stack is empty or editor-level history is blocked.
- `Redo` disabled when redo stack is empty or editor-level history is blocked.
- Buttons use native `button` semantics and accessible names `Undo` / `Redo`.

Keyboard shortcuts outside editable controls:

- macOS: `Meta+Z` -> Undo, `Meta+Shift+Z` -> Redo.
- Windows/Linux: `Ctrl+Z` -> Undo, `Ctrl+Shift+Z` -> Redo.
- Windows/Linux: `Ctrl+Y` -> Redo.

When the event target is an editable control (`input`, `textarea`, `select`, or contenteditable), the editor does not preventDefault and does not trigger graph history. Native/browser text undo wins.

Shortcuts are ignored while history is blocked by a Save Queue error or dirty Inspector draft.

## 10. React lifecycle and Board scope

History runtime is created per `boardId` and survives ordinary rerenders and save-state changes.

React StrictMode effect replay must not duplicate subscriptions or clear live history. The history runtime itself is synchronous and framework-independent; the hook owns only stable dispatch callbacks and keyboard/event integration.

Navigating to another Board creates an empty history stack. Returning later in a new mounted session does not restore old history.

## 11. Testing strategy

TDD is required.

### Pure history entry tests

Cover:

- move inverse uses explicit drag-start position,
- update-node inverse uses current canonical Node values,
- update-edge inverse uses current canonical Edge values,
- missing entity returns no entry,
- create/remove commands are not undoable.

### Pure history runtime tests

Cover:

- record -> undo -> redo stack movement,
- 100-entry capacity,
- new normal edit clears redo,
- unsupported normal command clears redo and creates a coalescing boundary,
- same-entity text updates within 2,000 ms coalesce,
- oldest inverse + newest forward preserved,
- different entity/kind does not coalesce,
- move never text-coalesces,
- explicit boundary breaks coalescing.

Use an injected clock (`now?: () => number`) rather than real sleeps.

### React adapter tests

Cover:

- normal supported dispatch derives history before Save Queue mutation,
- normal unsupported dispatch passes through but is not undoable,
- Undo dispatches inverse without re-recording,
- Redo dispatches forward without re-recording,
- replay callback fires for inverse/forward,
- blocked state prevents undo/redo,
- Board change resets history,
- StrictMode does not duplicate replay.

### Graph Editor page/component tests

Cover:

- header Undo/Redo enabled/disabled states,
- Node Inspector autosave becomes one undoable entry,
- continuous same-node edits coalesce to one Undo,
- Edge Inspector update undo/redo,
- Node drag captures starting position and one Undo restores it,
- Undo while forward save is pending queues the inverse and ends at the original durable value,
- dirty/invalid Inspector draft disables editor Undo/Redo,
- failed/409 lane disables Undo/Redo until Retry resolves,
- undo replay synchronizes Inspector draft so autosave does not immediately reapply the undone value,
- unsupported Create/Remove clears redo.

### Keyboard tests

Cover:

- Meta+Z / Meta+Shift+Z,
- Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y,
- editable input target is not intercepted,
- blocked history ignores shortcuts.

### E2E

Extend the authenticated Graph Editor workflow with durable `edit -> autosave -> Undo -> Saved -> reload -> verify original -> Redo -> Saved -> reload -> verify edited` behavior for one canonical Node edit and one drag move.

Do not use arbitrary sleeps; synchronize on PATCH responses and visible save state.

## 12. Documentation changes

Update:

- `src/frontend/features/graph-editor/AGENTS.md` to state that history stores command inverses and Undo/Redo persists through Save Queue, not snapshots/database rollback.
- `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md` to replace the future-tense Undo sentence with the implemented V1 history flow and supported-command boundary.

No backend contract, schema, migration, OpenAPI, or deployment change is required.

## 13. Non-goals

This slice does not implement:

- Undo for canonical Node/Edge creation.
- Undo for Board detach/remove.
- Canonical Node/Edge deletion API.
- Board reattach API.
- Edge source/target rewiring.
- Persistent history across reloads.
- Multi-user collaborative undo.
- event sourcing.
- CRDT/Yjs.
- WebSocket/realtime collaboration.
- automatic conflict merge.
- undo of invalid/raw Inspector keystrokes outside native browser input behavior.

## 14. Completion criteria

The slice is complete when:

1. Move Node, canonical Node edit, and canonical Edge edit produce exact inverse command history.
2. Undo/Redo always travels through Save Queue and survives reload after durable success.
3. Same-entity Inspector update commands coalesce into one semantic Undo within the approved 2,000 ms window.
4. Drag gestures produce exactly one history entry using drag-start position.
5. New normal edits invalidate redo, including unsupported create/remove commands.
6. Dirty/invalid Inspector drafts and Save Queue error block editor-level Undo/Redo without blocking native input undo.
7. Undo/Redo replay synchronizes existing Inspector drafts and does not self-reapply through autosave.
8. No backend/schema/migration changes are introduced.
9. Architecture, lint, typecheck, unit, PostgreSQL integration, production build, clean-tree, and Playwright E2E all pass on the exact feature head.
