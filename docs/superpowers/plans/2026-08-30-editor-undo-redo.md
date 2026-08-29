# Editor Undo/Redo V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable command-based Undo/Redo for Node moves and canonical Node/Edge edits while preserving Save Queue ordering, Inspector draft isolation, and current backend contracts.

**Architecture:** Introduce a Board-scoped history subsystem in front of the existing Save Queue. The subsystem derives inverse commands from current Zustand state, stores semantic `{forward, inverse}` entries, coalesces continuous Inspector updates, and replays inverse/forward commands through the existing Save Queue without teaching persistence or the queue about history.

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, TanStack Query 5, React Flow, Vitest 4, React Testing Library 16, Playwright 1.62, Next.js 16.

**Spec:** `docs/superpowers/specs/2026-08-30-editor-undo-redo-design.md`

## Global Constraints

- Undoable V1 commands are exactly `move-node`, `update-node`, and `update-edge`.
- `create-node`, `create-edge`, `remove-board-node`, and `remove-board-edge` are not undoable in this slice.
- Unsupported normal commands still clear redo and break text coalescing.
- History is Board-session memory only and is capped at 100 undo entries.
- History stores command pairs, never full Zustand snapshots.
- Undo/Redo always persists through the existing Save Queue.
- Save Queue retains ordering/retry responsibility and must not import history.
- Same-entity `update-node` / `update-edge` history coalesces within exactly 2,000 ms; preserve oldest inverse and newest forward.
- Node drag creates exactly one history entry from drag-start position to drag-stop position; drag frames remain Zustand-only.
- Dirty/invalid Inspector draft or Save Queue error blocks editor-level Undo/Redo.
- Editable controls keep native/browser text Undo and do not trigger graph history shortcuts.
- Undo/Redo replay synchronizes an existing Inspector draft for replayed Node/Edge canonical fields so autosave cannot immediately reapply the pre-Undo draft.
- No backend endpoint, contract, schema, migration, OpenAPI, realtime, CRDT/Yjs, event sourcing, or persistent history changes.

---

## File Structure Lock

Create:

```text
src/frontend/features/graph-editor/history/
├─ editor-history-entry.ts
├─ editor-history-entry.test.ts
├─ editor-history.ts
├─ editor-history.test.ts
├─ use-editor-history.ts
└─ use-editor-history.test.tsx
```

Modify:

```text
src/frontend/features/graph-editor/inspector/inspector-draft-store.ts
src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts
src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts
src/frontend/features/graph-editor/inspector/use-inspector-autosave.ts
src/frontend/widgets/graph-editor/graph-canvas.tsx
src/frontend/widgets/graph-editor/graph-canvas.test.tsx
src/frontend/pages/graph-editor/graph-editor-page.tsx
src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx
tests/e2e/auth-story.spec.ts
src/frontend/features/graph-editor/AGENTS.md
docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
```

Responsibilities:

- `editor-history-entry.ts`: supported-command type guard and inverse derivation.
- `editor-history.ts`: pure stack runtime, capacity, coalescing, redo invalidation, explicit boundary, snapshot.
- `use-editor-history.ts`: normal dispatch/undo/redo adapter around an injected Save Queue dispatch function; no HTTP.
- `inspector-draft-store.ts`: add exact replay replacement for an already-existing draft without exposing raw invalid data to Graph Zustand.
- `inspector-autosave-controller.ts` / hook: accept the history-aware normal dispatch function, not a direct queue-specific dependency.
- `graph-canvas.tsx`: emit drag-start identity/position boundary only.
- `graph-editor-page.tsx`: compose history, draft blocking, replay sync, selection boundaries, toolbar and keyboard shortcuts.

---

### Task 1: Add pure inverse derivation for supported editor commands

**Files:**
- Create: `src/frontend/features/graph-editor/history/editor-history-entry.ts`
- Create: `src/frontend/features/graph-editor/history/editor-history-entry.test.ts`
- Read: `src/frontend/features/graph-editor/commands/editor-command.ts`
- Read: `src/frontend/features/graph-editor/store/graph-editor-store.ts`

**Interfaces:**

```ts
import type {
  EditorCommand,
  MoveNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
} from "../commands/editor-command";
import type { GraphEditorStore } from "../store/graph-editor-store";

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

export function isUndoableEditorCommand(
  command: EditorCommand,
): command is UndoableEditorCommand;

export function createEditorHistoryEntry(input: {
  store: GraphEditorStore;
  command: EditorCommand;
  nowMs: number;
  moveStartPosition?: { x: number; y: number };
}): EditorHistoryEntry | null;
```

- [ ] **Step 1: Write failing inverse tests**

Create tests with a hydrated real `GraphEditorStore` and assert:

```ts
expect(
  createEditorHistoryEntry({
    store,
    command: {
      type: "update-node",
      boardId: "board-1",
      workspaceId: "workspace-1",
      nodeId: "node-1",
      version: 7,
      name: "Alicia",
      description: "Changed",
      properties: { role: "lead", age: 31 },
    },
    nowMs: 1000,
  }),
).toMatchObject({
  inverse: {
    type: "update-node",
    nodeId: "node-1",
    name: "Alice",
    description: "Original",
    properties: { role: "lead" },
  },
  coalescingKey: "update-node:node-1",
});
```

Add Edge equivalent and Move:

```ts
expect(entry?.inverse).toMatchObject({
  type: "move-node",
  nodeId: "node-1",
  position: { x: 100, y: 200 },
});
```

Move passes `moveStartPosition` explicitly even though current BoardNode is already at the drag-stop position.

Add no-op/missing cases:

```text
move without moveStartPosition -> null
move start == stop -> null
missing Node/Edge -> null
create/remove commands -> null
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
pnpm test -- src/frontend/features/graph-editor/history/editor-history-entry.test.ts
```

Expected: FAIL because `editor-history-entry.ts` does not exist.

- [ ] **Step 3: Implement minimal type guard and inverse derivation**

Rules:

```ts
update-node inverse.version = current.version;
update-edge inverse.version = current.version;
move inverse.position = moveStartPosition;
```

Forward command remains the exact incoming supported command. Coalescing key is non-null only for `update-node` / `update-edge`; Move uses `null`.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/frontend/features/graph-editor/history/editor-history-entry*
git commit -m "feat: derive editor history inverses"
```

---

### Task 2: Add framework-independent undo/redo history runtime

**Files:**
- Create: `src/frontend/features/graph-editor/history/editor-history.ts`
- Create: `src/frontend/features/graph-editor/history/editor-history.test.ts`
- Consume: `EditorHistoryEntry`, `UndoableEditorCommand`

**Interfaces:**

```ts
export type EditorHistorySnapshot = {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
};

export type EditorHistory = {
  record(entry: EditorHistoryEntry): void;
  noteNormalCommand(command: EditorCommand): void;
  boundary(): void;
  undo(replay: (command: UndoableEditorCommand) => boolean): boolean;
  redo(replay: (command: UndoableEditorCommand) => boolean): boolean;
  getSnapshot(): EditorHistorySnapshot;
  subscribe(listener: () => void): () => void;
};

export function createEditorHistory(options?: {
  capacity?: number;
  coalesceWindowMs?: number;
}): EditorHistory;
```

`record()` is called only for a supported normal command after its entry is derived and before its forward Save Queue dispatch. It clears redo and records/coalesces the entry.

`noteNormalCommand()` is used for unsupported normal commands; it clears redo and establishes a coalescing boundary without adding Undo.

`undo(replay)` and `redo(replay)` must move stack entries **only if `replay(command)` returns true**. This prevents history stack corruption if the underlying Save Queue dispatch rejects local application.

- [ ] **Step 1: Write failing stack behavior tests**

Test:

```text
record A, record B
snapshot undoCount=2 redoCount=0
undo success -> undoCount=1 redoCount=1
redo success -> undoCount=2 redoCount=0
```

Also test replay returns false:

```text
undo replay false -> stacks unchanged
redo replay false -> stacks unchanged
```

- [ ] **Step 2: Write failing redo invalidation and capacity tests**

Assert:

```text
undo -> record new normal entry -> redoCount=0
undo -> noteNormalCommand(create-node) -> redoCount=0
capacity=3 + 4 entries -> only newest 3 undoable
```

- [ ] **Step 3: Write failing coalescing tests**

Use entries whose `updatedAtMs` values are deterministic.

Cases:

```text
same update-node key, delta 1999 ms -> one entry
same key, delta 2000 ms -> one entry (inclusive window)
same key, delta 2001 ms -> two entries
different Node -> two entries
update-node then update-edge -> two entries
boundary between same key -> two entries
move between same key updates -> no cross-move coalescing
```

For a coalesced entry assert oldest inverse and newest forward.

- [ ] **Step 4: Run runtime tests and verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/history/editor-history.test.ts
```

Expected: FAIL because runtime module does not exist.

- [ ] **Step 5: Implement runtime**

Use plain arrays and a monotonic `boundaryGeneration` integer. Store the generation on internal undo records so `boundary()` prevents later coalescing even if the key/time would otherwise match.

Publish a new immutable snapshot only when stack state changes.

- [ ] **Step 6: Run Task 1 + Task 2 tests and verify GREEN**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/history/editor-history-entry.test.ts \
  src/frontend/features/graph-editor/history/editor-history.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/frontend/features/graph-editor/history/editor-history*
git commit -m "feat: add editor history runtime"
```

---

### Task 3: Add React history adapter around Save Queue dispatch

**Files:**
- Create: `src/frontend/features/graph-editor/history/use-editor-history.ts`
- Create: `src/frontend/features/graph-editor/history/use-editor-history.test.tsx`
- Read: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.ts`

**Interfaces:**

```ts
export type UseEditorHistoryResult = {
  dispatch(
    command: EditorCommand,
    options?: { moveStartPosition?: { x: number; y: number } },
  ): string | null;
  undo(): boolean;
  redo(): boolean;
  boundary(): void;
  snapshot: EditorHistorySnapshot;
};

export function useEditorHistory(input: {
  store: GraphEditorStore;
  boardId: string;
  dispatchToSaveQueue(command: EditorCommand): string | null;
  blocked: boolean;
  onReplayCommand?(command: UndoableEditorCommand): void;
}): UseEditorHistoryResult;
```

- [ ] **Step 1: Write failing normal dispatch tests**

Use a real GraphEditorStore plus a mocked `dispatchToSaveQueue` that applies the incoming command with `applyEditorCommand()` before returning `operation-1`, matching the real Save Queue wrapper contract.

Assert supported update derives history from the pre-apply Node value and then forwards exactly once.

Assert create/remove forwards exactly once, creates no undo entry, and clears redo after an Undo.

- [ ] **Step 2: Write failing Undo/Redo replay tests**

Sequence:

```text
normal update Alice -> Alicia
undo -> dispatchToSaveQueue inverse Alice
redo -> dispatchToSaveQueue forward Alicia
```

Assert dispatch call count is 3 total and history entry count does not recursively grow during replay.

Assert `onReplayCommand` gets inverse on Undo and forward on Redo only after the Save Queue dispatch returns non-null.

- [ ] **Step 3: Write failing blocked and Board scope tests**

Assert:

```text
blocked=true -> undo false / redo false / no dispatch
rerender same board -> history retained
rerender different board -> empty history
```

Wrap one test in `StrictMode` and verify one Undo click/replay produces one queue dispatch.

- [ ] **Step 4: Run hook test and verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/history/use-editor-history.test.tsx
```

Expected: FAIL because hook does not exist.

- [ ] **Step 5: Implement hook**

Create runtime with:

```ts
const history = useMemo(() => createEditorHistory(), [boardId]);
```

Subscribe using `useSyncExternalStore`.

Normal dispatch algorithm:

```text
derive entry from current store
if entry -> history.record(entry)
else -> history.noteNormalCommand(command)
dispatchToSaveQueue(command)
if dispatch rejected -> restore history mutation
```

To keep rejection rollback explicit, add internal history checkpoint support only if tests require it; preferred implementation is to call queue dispatch first only after deriving the entry, then record/note after a non-null operation ID. Because `dispatchToSaveQueue` applies Zustand synchronously, entry derivation must occur before the call, but recording can occur immediately after successful return.

Undo/Redo use runtime `undo()` / `redo()` replay callbacks that call `dispatchToSaveQueue()` and return whether an operation ID was produced.

- [ ] **Step 6: Run hook + pure history tests and verify GREEN**

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/frontend/features/graph-editor/history/use-editor-history*
git commit -m "feat: connect editor history to save queue"
```

---

### Task 4: Add Inspector replay synchronization and route autosave through history

**Files:**
- Modify: `src/frontend/features/graph-editor/inspector/inspector-draft-store.ts`
- Modify: `src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts`
- Modify: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts`
- Modify: `src/frontend/features/graph-editor/inspector/use-inspector-autosave.ts`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`

**Interfaces:**

Add to `InspectorDraftState`:

```ts
replaceDraft(
  key: InspectorEntityKey,
  input: Pick<InspectorDraft, "name" | "description" | "propertiesText">,
): void;
```

Behavior:

- missing key -> no-op,
- exact same raw values -> no-op,
- changed values -> replace those three fields and increment revision exactly once.

Autosave controller already consumes a generic command dispatch signature. Keep it as:

```ts
dispatch(command: EditorCommand): string | null;
```

but pass `history.dispatch` from the page instead of `saveQueue.dispatch`.

- [ ] **Step 1: Write failing `replaceDraft` tests**

Assert existing invalid draft can be replaced with replayed canonical raw values and revision increments once; missing key is no-op.

- [ ] **Step 2: Implement `replaceDraft` and verify GREEN**

Run Draft Store tests.

- [ ] **Step 3: Convert Inspector page tests to expect history behavior**

Add focused Node test:

```text
Alice -> Alicia via autosave
Undo enabled
click Undo
visible Name becomes Alice
advance timers beyond autosave window
updateNode called only for original forward + Undo inverse, not a third reapply
click Redo
visible Name becomes Alicia
```

Add Edge equivalent.

Add continuous coalescing:

```text
Alice -> Alicia (autosave)
<2s later -> Alicia V. (autosave)
Undo once -> Alice
```

Use fake timers and no arbitrary real sleeps.

- [ ] **Step 4: Wire page history and replay callback**

Create history after Save Queue:

```ts
const historyBlocked =
  hasDirtyInspectorDraft || saveQueue.snapshot.saveState === "error";

const history = useEditorHistory({
  store,
  boardId,
  dispatchToSaveQueue: saveQueue.dispatch,
  blocked: historyBlocked,
  onReplayCommand(command) {
    if (command.type === "update-node") {
      draftStore.getState().replaceDraft(`node:${command.nodeId}`, {
        name: command.name,
        description: command.description,
        propertiesText: JSON.stringify(command.properties, null, 2),
      });
    }
    if (command.type === "update-edge") {
      draftStore.getState().replaceDraft(`edge:${command.edgeId}`, {
        name: command.name,
        description: command.description,
        propertiesText: JSON.stringify(command.properties, null, 2),
      });
    }
  },
});
```

Because `hasDirtyInspectorDraft` currently appears before header render, structure computations so history can consume it without circular dependencies.

Pass `history.dispatch` to `useInspectorAutosave`.

Every direct normal page command (`create-node`, `create-edge`, remove) also goes through `history.dispatch` so redo invalidation/boundaries are correct.

- [ ] **Step 5: Break coalescing on selection change**

On Node/Edge selection change call `history.boundary()` before setting a new selected entity. Do not call boundary merely because a persistence response changed entity version.

- [ ] **Step 6: Run Inspector/history focused tests and verify GREEN**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts \
  src/frontend/features/graph-editor/history/use-editor-history.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/frontend/features/graph-editor/inspector \
        src/frontend/pages/graph-editor/graph-editor-page.tsx \
        src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
git commit -m "feat: integrate inspector edits with history"
```

---

### Task 5: Add drag history, toolbar controls, and keyboard shortcuts

**Files:**
- Modify: `src/frontend/widgets/graph-editor/graph-canvas.tsx`
- Modify: `src/frontend/widgets/graph-editor/graph-canvas.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Modify/Create focused page tests under `src/frontend/pages/graph-editor/`

**Interfaces:**

Add canvas prop:

```ts
onNodeDragStart?: (nodeId: string) => void;
```

Page owns:

```ts
const dragStartPositionsRef = useRef(
  new Map<string, { x: number; y: number }>(),
);
```

- [ ] **Step 1: Write failing canvas drag-start test**

Assert React Flow `onNodeDragStart` forwards the Node id exactly once before drag position changes.

- [ ] **Step 2: Implement drag-start callback**

Add `OnNodeDrag` handler and prop, keeping React Flow-specific objects inside the widget.

- [ ] **Step 3: Write failing page drag history test**

Use a BoardNode at `(100, 100)`:

```text
drag start -> capture (100,100)
drag frame/stop -> Zustand (500,300)
move persistence forward
after success Undo -> Zustand (100,100), second move persistence
Redo -> (500,300)
```

Assert one drag gesture creates only one undo entry.

- [ ] **Step 4: Implement page drag integration**

`handleNodeDragStart(nodeId)` reads the current BoardNode before any drag frame and stores position in the ref.

`handleNodeDragStop(nodeId)` reads start + latest stop. If missing start or equal positions, do not dispatch. Otherwise call:

```ts
history.dispatch(
  {
    type: "move-node",
    boardId,
    nodeId,
    workspaceId,
    position: stop,
  },
  { moveStartPosition: start },
);
```

Delete the captured start position after stop.

- [ ] **Step 5: Write failing toolbar state tests**

Assert initial `Undo` and `Redo` disabled. After durable history-producing action, Undo enabled. After Undo, Redo enabled.

Dirty invalid draft -> both disabled. Save Queue `Error` -> both disabled even with history available.

- [ ] **Step 6: Implement toolbar controls**

Render near save indicator:

```tsx
<button type="button" onClick={history.undo} disabled={!canUndo}>Undo</button>
<button type="button" onClick={history.redo} disabled={!canRedo}>Redo</button>
```

`canUndo/canRedo` include the `historyBlocked` gate in the page; runtime snapshot itself remains stack-only.

- [ ] **Step 7: Write failing keyboard shortcut tests**

Add pure helper inside `use-editor-history.ts` or a separate private export for testing:

```ts
export function getEditorHistoryShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "target">,
): "undo" | "redo" | null;
```

Cases:

```text
Meta+Z -> undo
Meta+Shift+Z -> redo
Ctrl+Z -> undo
Ctrl+Shift+Z -> redo
Ctrl+Y -> redo
input/textarea/select/contenteditable target -> null
plain Z/Y -> null
```

- [ ] **Step 8: Implement global keyboard listener**

In the hook, attach one `window.keydown` listener. On recognized shortcut and `blocked === false`, call Undo/Redo; call `preventDefault()` only when graph history actually handles the shortcut.

Use stable callbacks/effect dependencies so StrictMode does not double-handle one keydown.

- [ ] **Step 9: Run focused page/canvas/history tests and verify GREEN**

Expected: PASS.

- [ ] **Step 10: Commit Task 5**

```bash
git add src/frontend/widgets/graph-editor/graph-canvas* \
        src/frontend/features/graph-editor/history \
        src/frontend/pages/graph-editor
git commit -m "feat: add graph editor undo redo controls"
```

---

### Task 6: Verify pending/error ordering and unsupported command branch semantics

**Files:**
- Modify: `src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx`
- Modify existing Board removal/create tests only where history behavior needs explicit assertions.

- [ ] **Step 1: Write failing pending-forward Undo test**

Use a deferred `updateNode` persistence promise.

```text
forward Alicia applies locally and request remains pending
Undo clicked while lane saving
local Node becomes Alice immediately
resolve first request
second inverse request runs after it
resolve inverse
header Saved
```

Assert persisted call order `Alicia` then `Alice` and final working value `Alice`.

- [ ] **Step 2: Write failing 409/error block test**

Create history, make latest update return 409, assert header `Error`, Undo and Redo disabled. Click Retry and resolve success; after queue returns non-error, history button eligibility returns from stack state.

- [ ] **Step 3: Write failing unsupported create/remove redo invalidation test**

Sequence:

```text
undoable Node edit
Undo -> Redo available
Create Node (unsupported)
Redo disabled
```

Repeat with Remove from Board if existing fixture is convenient. One unsupported command regression is mandatory; both are preferred if existing tests make them cheap.

- [ ] **Step 4: Implement/fix only if tests expose gaps**

Do not add backend inverse APIs. Fix adapter/runtime boundaries only.

- [ ] **Step 5: Run focused regressions and verify GREEN**

```bash
pnpm test -- \
  src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx
```

- [ ] **Step 6: Commit Task 6**

```bash
git add src/frontend/pages/graph-editor
git commit -m "test: verify editor history ordering"
```

---

### Task 7: Update E2E and architecture documentation, then run full verification

**Files:**
- Modify: `tests/e2e/auth-story.spec.ts`
- Modify: `src/frontend/features/graph-editor/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`
- Verify: `docs/superpowers/specs/2026-08-30-editor-undo-redo-design.md`

- [ ] **Step 1: Add durable Node edit Undo/Redo E2E**

Within the authenticated Graph Editor scenario:

```text
select Node Alice
edit to Alicia
wait PATCH 200 + Saved
click Undo
wait inverse PATCH 200 + Saved
reload
assert Alice
click/select as needed and redo is not expected to survive reload
```

Because history is session-only, Redo must be tested before reload:

```text
Alicia save
Undo save -> Alice
Redo save -> Alicia
Undo save -> Alice
reload -> Alice
```

This proves both directions and durable final original state while respecting non-persistent history.

- [ ] **Step 2: Add durable drag Undo E2E**

Use actual React Flow drag. Capture server snapshot placement before drag, perform drag and await BoardNode PATCH, click Undo and await second BoardNode PATCH, then reload and verify the original placement.

Do not use arbitrary `waitForTimeout`.

- [ ] **Step 3: Update Graph Editor AGENTS invariant**

Add one concise rule while staying near the existing size budget:

```md
- Undo/Redo는 command inverse를 Save Queue로 재실행하며 snapshot/DB rollback을 사용하지 않는다.
```

If the file exceeds its established concise style, tighten neighboring wording rather than adding another AGENTS file.

- [ ] **Step 4: Synchronize architecture design**

Document implemented V1 flow:

```text
normal edit -> derive inverse -> History -> Save Queue
Undo -> inverse Command -> Save Queue
Redo -> forward Command -> Save Queue
```

State V1 support is Move Node + canonical Node/Edge edit; Create/Remove remain deferred until exact inverse backend operations exist.

- [ ] **Step 5: Commit E2E/docs**

```bash
git add tests/e2e/auth-story.spec.ts \
        src/frontend/features/graph-editor/AGENTS.md \
        docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
git commit -m "test: verify editor undo redo workflow"
```

- [ ] **Step 6: Run repository verification**

Required evidence:

```bash
pnpm db:check
pnpm check:agents
pnpm check:boundaries
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
git diff --exit-code
pnpm e2e
```

If the connected environment cannot execute a local command directly, use the repository CI on the exact feature head and explicitly note any command not represented by CI rather than claiming it was run.

Expected acceptance evidence:

```text
AGENTS validation PASS
import-boundary validation PASS
ESLint PASS
TypeScript PASS
all unit PASS
all PostgreSQL integration PASS
production build PASS
tracked/generated tree clean
Playwright critical Graph Editor flows PASS
```

- [ ] **Step 7: Direct diff review against main**

Review specifically for:

```text
no backend/schema/migration changes
no full Zustand snapshot history
no HTTP/TanStack imports in history runtime
no Save Queue import of history
no recursive history recording during Undo/Redo
no history version used as authoritative CAS version
no drag-frame history recording
no false graph shortcut interception inside editable controls
no Undo/Redo while dirty invalid draft or queue error
no Inspector replay/autosave feedback loop
unsupported create/remove clears redo but is not undoable
same-Board hydration guard unchanged
Board = View invariant unchanged
```

Fix every Critical/Important finding with a regression test before completion.

- [ ] **Step 8: Open Draft PR with exact verification evidence**

PR body must state:

```text
exact feature head SHA
supported Undo/Redo commands
2,000 ms text coalescing behavior
drag history behavior
Inspector draft replay behavior
error/Retry behavior
unit/integration/E2E counts
architecture review result
explicitly deferred Create/Remove Undo
```

Do not merge automatically.

---

## Plan Self-Review Checklist

- Spec coverage: supported command boundary, inverse derivation, 100-entry capacity, 2,000 ms coalescing, redo invalidation, drag-start capture, pending writes, 409/error block, dirty Inspector block, native input Undo, replay draft synchronization, Board reset, keyboard controls, E2E persistence, docs all map to tasks.
- Placeholder scan: no TODO/TBD/"similar to" implementation gaps are allowed.
- Type consistency: `UndoableEditorCommand`, `EditorHistoryEntry`, `EditorHistorySnapshot`, `createEditorHistoryEntry`, `createEditorHistory`, `useEditorHistory`, `replaceDraft` are defined before use.
- Architecture: Save Queue remains unchanged as scheduler; history has no backend/HTTP dependency; no backend inverse API scope creep.
