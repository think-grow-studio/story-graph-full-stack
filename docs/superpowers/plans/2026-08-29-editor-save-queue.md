# Editor Save Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all Graph Editor durable writes through an entity-lane Save Queue while keeping Zustand working state immediate, preserving failed local edits, coalescing pending Node moves, and showing `Saved / Saving / Unsaved / Error` state.

**Architecture:** Split the current command executor into an immediate local-apply phase and a durable persist/reconcile phase. A framework-independent Save Queue serializes commands per Node/Edge lane, coalesces only not-yet-started `move-node` commands, stops failed lanes until explicit retry, and lets unrelated lanes continue. A React hook owns one queue per mounted Board editor and the page dispatches commands into it while TanStack mutations remain behind `EditorPersistence`.

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, TanStack Query 5, Vitest 4, React Testing Library, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-08-29-editor-save-queue-design.md`

## Global Constraints

- PostgreSQL remains durable truth; TanStack Query owns fetched/cache/mutation lifecycle; Zustand owns editor working state; React Flow remains rendering/input only.
- Frontend must not import backend, Drizzle, or DB modules; server access remains behind `frontend/api` and `/api/v1` contracts.
- Board remains a View; canonical Node/Edge remain Story-owned.
- Local editor changes happen before persistence waits.
- Same-entity commands are durably ordered; unrelated Node/Edge lanes may progress independently.
- Only pending, not-yet-started `move-node` commands for the same Node may coalesce.
- Persistence failure keeps the user's working state and stops only the failed lane.
- Retry is explicit/manual in this slice; no infinite automatic retry, backoff loop, background job queue, realtime, CRDT, event sourcing, or DB-history rollback.
- Inspector remains explicit-save; debounce/autosave and invalid intermediate JSON draft handling are deferred.
- Same-Board Query cache changes must not trigger full Zustand hydration.
- No backend endpoint, schema, migration, or canonical-delete change is expected.

---

### Task 1: Split Editor command local application from durable persistence/reconcile

**Files:**
- Create: `src/frontend/features/graph-editor/commands/editor-command-runtime.ts`
- Create: `src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command-executor.ts`
- Modify or retire tests as appropriate: `src/frontend/features/graph-editor/commands/editor-command-executor.test.ts`
- Read: `src/frontend/features/graph-editor/store/graph-editor-store.ts`
- Read: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`

**Interfaces:**
- Produces `applyEditorCommand(store, command): boolean` where `false` means a no-op Board detach should not be queued.
- Produces `persistAndReconcileEditorCommand(store, persistence, command): Promise<void>`.
- Produces `prepareEditorCommandForPersistence(store, command): EditorCommand` internally so queued Node/Edge updates use the latest locally known optimistic-lock version after earlier same-lane writes succeed.
- `editor-command-runtime.ts` must not import React, React Flow, Axios, backend, Drizzle, or database modules.

- [ ] **Step 1: Write RED tests for immediate local application without persistence**

Create `editor-command-runtime.test.ts` using `createGraphEditorStore()` and a mocked `EditorPersistence`.

```ts
it("applies a create Node locally without calling persistence", () => {
  const store = hydratedStore();
  const command = createNodeCommand();

  expect(applyEditorCommand(store, command)).toBe(true);

  expect(store.getState().nodes.some((node) => node.id === command.nodeId)).toBe(true);
  expect(store.getState().boardNodes.some((node) => node.nodeId === command.nodeId)).toBe(true);
});

it("keeps a locally created Node when durable create fails", async () => {
  const store = hydratedStore();
  const durable = persistence();
  const command = createNodeCommand();
  applyEditorCommand(store, command);
  vi.mocked(durable.createNode).mockRejectedValue(new Error("offline"));

  await expect(
    persistAndReconcileEditorCommand(store, durable, command),
  ).rejects.toThrow("offline");

  expect(store.getState().nodes.some((node) => node.id === command.nodeId)).toBe(true);
});
```

Also add RED cases proving `update-node`, `update-edge`, `remove-board-node`, and `remove-board-edge` change working state immediately and are not rolled back by a durable failure.

- [ ] **Step 2: Run the focused runtime test and capture RED**

Run:

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
```

Expected: FAIL because `editor-command-runtime.ts` does not exist.

- [ ] **Step 3: Implement the immediate local phase**

Implement the command switch with existing Zustand methods. For update commands, preserve the current entity `version` until durable reconciliation returns a newer version.

```ts
export function applyEditorCommand(
  store: GraphEditorStore,
  command: EditorCommand,
): boolean {
  switch (command.type) {
    case "create-node":
      store.getState().addOptimisticNode(toOptimisticNodePair(command));
      return true;
    case "move-node":
      store.getState().setNodePosition(command.nodeId, command.position);
      return true;
    case "create-edge":
      store.getState().addOptimisticEdge(toOptimisticEdgePair(command));
      return true;
    case "update-node": {
      const current = store.getState().nodes.find((node) => node.id === command.nodeId);
      if (!current) return false;
      store.getState().replaceNode({
        ...current,
        name: command.name,
        description: command.description,
        properties: command.properties,
      });
      return true;
    }
    case "update-edge": {
      const current = store.getState().edges.find((edge) => edge.id === command.edgeId);
      if (!current) return false;
      store.getState().replaceEdge({
        ...current,
        name: command.name,
        description: command.description,
        properties: command.properties,
      });
      return true;
    }
    case "remove-board-node":
      return store.getState().detachNodeFromBoard(command.nodeId).boardNode !== null;
    case "remove-board-edge":
      return store.getState().detachEdgeFromBoard(command.edgeId) !== null;
  }
}
```

Move the existing optimistic pair builders into this runtime module or a focused helper under `commands/`; do not duplicate them.

- [ ] **Step 4: Add RED tests for stale reconcile protection**

Cover at least create→newer move and running move→newer move.

```ts
it("does not snap a newer working position back to an older persisted move", async () => {
  const store = hydratedStore();
  const durable = persistence();
  const command = moveNodeCommand({ x: 100, y: 100 });
  applyEditorCommand(store, command);
  store.getState().setNodePosition(command.nodeId, { x: 180, y: 180 });
  vi.mocked(durable.moveNode).mockResolvedValue(persistedBoardNode({ x: 100, y: 100 }));

  await persistAndReconcileEditorCommand(store, durable, command);

  expect(boardNode(store, command.nodeId)).toMatchObject({ x: 180, y: 180 });
});
```

Also verify a delayed `create-node` response does not overwrite a newer local BoardNode position.

- [ ] **Step 5: Implement durable persistence and guarded reconciliation**

Before persisting `update-node`/`update-edge`, derive a command with the latest local canonical version so a queued second save follows the version returned by the first same-lane save.

```ts
function prepareEditorCommandForPersistence(
  store: GraphEditorStore,
  command: EditorCommand,
): EditorCommand {
  if (command.type === "update-node") {
    const current = store.getState().nodes.find((node) => node.id === command.nodeId);
    return current ? { ...command, version: current.version } : command;
  }
  if (command.type === "update-edge") {
    const current = store.getState().edges.find((edge) => edge.id === command.edgeId);
    return current ? { ...command, version: current.version } : command;
  }
  return command;
}
```

Reconcile returned canonical/server metadata while preserving newer working fields. For `move-node`, keep current `x/y` when they no longer equal the persisted command position. For `update-node`/`update-edge`, keep newer local editable fields when they differ from the command being acknowledged, but always advance the server-returned `version`/timestamps. Removal success requires no local mutation because detach already happened.

- [ ] **Step 6: Run runtime tests to GREEN**

Run:

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
```

Expected: PASS for immediate local apply, no rollback on failure, latest-version preparation, and stale-response protection.

- [ ] **Step 7: Keep `executeEditorCommand()` only as a compatibility helper or remove it after page migration**

If retained temporarily, implement it in terms of the new phases so there is one source of command semantics:

```ts
export async function executeEditorCommand(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  command: EditorCommand,
): Promise<void> {
  if (!applyEditorCommand(store, command)) return;
  await persistAndReconcileEditorCommand(store, persistence, command);
}
```

Do not keep the old rollback logic.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/frontend/features/graph-editor/commands
git commit -m "refactor: split editor command runtime phases"
```

---

### Task 2: Build the framework-independent entity-lane Save Queue

**Files:**
- Create: `src/frontend/features/graph-editor/save-queue/save-state.ts`
- Create: `src/frontend/features/graph-editor/save-queue/editor-save-queue.ts`
- Create: `src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts`
- Read: `src/frontend/features/graph-editor/commands/editor-command.ts`

**Interfaces:**
- Produces `SaveState = "saved" | "saving" | "unsaved" | "error"`.
- Produces `createEditorSaveQueue({ execute })`.
- Queue API:

```ts
export type EditorSaveQueueSnapshot = {
  saveState: SaveState;
  pendingCount: number;
  runningCount: number;
  failedCount: number;
  failedOperations: readonly FailedEditorOperation[];
  laneStates: Readonly<Record<string, "pending" | "saving" | "error">>;
};

export type EditorSaveQueue = {
  enqueue(command: EditorCommand): string;
  retryFailed(): void;
  getSnapshot(): EditorSaveQueueSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};
```

- Operation IDs are client-only queue identities generated with an injectable `createOperationId` in tests or `crypto.randomUUID()` by default.
- Lane key is exactly `node:${nodeId}` for Node commands and `edge:${edgeId}` for Edge commands.

- [ ] **Step 1: Write RED queue state/order tests**

Use deferred promises so exact running/pending states are deterministic.

```ts
it("transitions saved -> unsaved -> saving -> saved", async () => {
  const gate = deferred<void>();
  const queue = createEditorSaveQueue({
    execute: vi.fn(() => gate.promise),
    createOperationId: sequenceIds(),
  });

  queue.enqueue(moveNodeCommand(aliceId, 100));
  expect(queue.getSnapshot().saveState).toMatch(/unsaved|saving/);

  await flushMicrotasks();
  expect(queue.getSnapshot().saveState).toBe("saving");

  gate.resolve();
  await flushMicrotasks();
  expect(queue.getSnapshot().saveState).toBe("saved");
});
```

Add RED tests for same-lane FIFO and unrelated-lane independence.

- [ ] **Step 2: Run queue test and capture RED**

Run:

```bash
pnpm test -- src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts
```

Expected: FAIL because the Save Queue modules do not exist.

- [ ] **Step 3: Implement lane storage and aggregate save state**

Use internal lane objects containing at most one running operation plus ordered pending operations and an optional failed head. Schedule processing with `queueMicrotask()` so `enqueue()` can expose an observable `unsaved` state before execution begins.

Aggregate priority must be exact:

```ts
function deriveSaveState(lanes: Iterable<Lane>): SaveState {
  if ([...lanes].some((lane) => lane.failed)) return "error";
  if ([...lanes].some((lane) => lane.running)) return "saving";
  if ([...lanes].some((lane) => lane.pending.length > 0)) return "unsaved";
  return "saved";
}
```

Notify subscribers whenever queue state changes.

- [ ] **Step 4: Write RED Move coalescing tests**

```ts
it("coalesces only not-yet-started moves for the same Node", async () => {
  const first = deferred<void>();
  const execute = vi.fn()
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValue(undefined);
  const queue = createEditorSaveQueue({ execute, createOperationId: sequenceIds() });

  queue.enqueue(moveNodeCommand(aliceId, 100));
  await flushMicrotasks();
  queue.enqueue(moveNodeCommand(aliceId, 120));
  queue.enqueue(moveNodeCommand(aliceId, 180));

  first.resolve();
  await flushMicrotasks();

  expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({ position: { x: 100, y: 100 } }));
  expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({ position: { x: 180, y: 180 } }));
  expect(execute).toHaveBeenCalledTimes(2);
});
```

Add a test proving a pending `move-node` is not coalesced across `update-node`, create, or remove commands.

- [ ] **Step 5: Implement pending Move coalescing**

When enqueueing a `move-node`, scan only the same lane's pending tail after the most recent non-move barrier. Replace the latest pending Move for that Node instead of appending another operation. Never mutate the running or failed operation.

- [ ] **Step 6: Write RED failure/retry tests**

Cover:

```text
lane A fails -> SaveState error -> lane A stops
lane B continues -> succeeds
retryFailed() -> failed A operation executes before later A commands
successful retry -> queue eventually saved
```

Ensure the failed operation remains available in `failedOperations` with its command and error.

- [ ] **Step 7: Implement failed-lane/manual-retry behavior**

On `execute()` rejection, keep that operation as the lane's failed head, record the error, do not automatically call `execute()` again, and leave later same-lane operations pending. `retryFailed()` clears failed markers and schedules those lanes again without changing operation order.

- [ ] **Step 8: Run queue tests to GREEN**

Run:

```bash
pnpm test -- src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts
```

Expected: PASS for save-state transitions, same-lane ordering, cross-lane independence, Move coalescing, failure isolation, and manual retry.

- [ ] **Step 9: Commit Task 2**

```bash
git add src/frontend/features/graph-editor/save-queue
git commit -m "feat: add editor entity save queue"
```

---

### Task 3: Add the Board-scoped React Save Queue hook

**Files:**
- Create: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.ts`
- Create: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx`
- Modify: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Read: `src/frontend/features/graph-editor/store/graph-editor-store-provider.tsx`

**Interfaces:**
- `useEditorPersistence()` continues to return the `EditorPersistence` boundary; page code must stop depending on per-mutation pending flags after migration.
- Produces:

```ts
export type UseEditorSaveQueueResult = {
  dispatch(command: EditorCommand): string | null;
  retryFailed(): void;
  snapshot: EditorSaveQueueSnapshot;
  getLaneState(commandOrLane: EditorCommand | string): "idle" | "pending" | "saving" | "error";
};

export function useEditorSaveQueue(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  boardId: string,
): UseEditorSaveQueueResult;
```

- The hook owns one queue instance for the mounted Board and disposes/recreates it when `boardId` changes.

- [ ] **Step 1: Write a RED hook test**

Render a small harness with a real vanilla editor store and mocked persistence. Verify `dispatch()` applies local state synchronously before the mocked persistence promise resolves, then verify the hook snapshot reaches `saving` and finally `saved`.

```tsx
act(() => result.current.dispatch(moveNodeCommand(aliceId, 180)));
expect(boardNode(store, aliceId).x).toBe(180);
expect(result.current.snapshot.saveState).toMatch(/unsaved|saving/);
```

- [ ] **Step 2: Run the hook test and capture RED**

Run:

```bash
pnpm test -- src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook with `useSyncExternalStore`**

Keep the current `persistence` object in a ref so React renders do not recreate the queue. The queue executor must call the Task 1 durable phase.

```ts
const persistenceRef = useRef(persistence);
persistenceRef.current = persistence;

const queue = useMemo(
  () => createEditorSaveQueue({
    execute: (command) =>
      persistAndReconcileEditorCommand(store, persistenceRef.current, command),
  }),
  [boardId, store],
);

const snapshot = useSyncExternalStore(
  queue.subscribe,
  queue.getSnapshot,
  queue.getSnapshot,
);

const dispatch = useCallback((command: EditorCommand) => {
  if (!applyEditorCommand(store, command)) return null;
  return queue.enqueue(command);
}, [queue, store]);
```

Dispose the previous queue in an effect cleanup. Do not full-hydrate Zustand when queue snapshots change.

- [ ] **Step 4: Simplify `useEditorPersistence()` return shape**

After page migration no code should need `pending.createNode` etc. Return `{ persistence }` only, unless another current consumer is proven by search. Keep all TanStack cache synchronization inside the existing graph mutation hooks.

- [ ] **Step 5: Run hook/runtime/queue tests to GREEN**

Run:

```bash
pnpm test -- \
  src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts \
  src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts \
  src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/frontend/features/graph-editor/save-queue src/frontend/features/graph-editor/persistence
git commit -m "feat: connect editor save queue to persistence"
```

---

### Task 4: Route Graph Editor writes through the queue and show visible save state

**Files:**
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Create: `src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx`
- Modify as required for changed async semantics:
  - `src/frontend/pages/graph-editor/graph-editor-page.test.tsx`
  - `src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx`
  - `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`
  - `src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx`
  - `src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx`

**Interfaces:**
- Page calls `dispatch(command)` instead of `await executeEditorCommand(...)`.
- `snapshot.saveState` drives the header indicator.
- `retryFailed()` drives the single generic Retry action.
- Existing form validation and 409-specific wording remain page concerns.

- [ ] **Step 1: Write RED save-indicator tests**

Mock the queue hook or use deferred persistence through the existing page test harness. Verify exact visible states:

```tsx
expect(screen.getByText("Saved")).toBeInTheDocument();
// after dispatch before/while durable execution
expect(await screen.findByText(/Saving|Unsaved/)).toBeInTheDocument();
// after rejection
expect(await screen.findByText("Error")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
```

Click Retry, resolve persistence, and verify the indicator returns to `Saved`.

- [ ] **Step 2: Run the save-state test and capture RED**

Run:

```bash
pnpm test -- src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx
```

Expected: FAIL because no generic save indicator/Retry exists and page writes still bypass the queue.

- [ ] **Step 3: Replace page write orchestration with `useEditorSaveQueue()`**

Initialize after obtaining the editor store and persistence:

```ts
const { persistence } = useEditorPersistence(workspaceId, boardId);
const saveQueue = useEditorSaveQueue(store, persistence, boardId);
```

Every current write handler constructs the same seven command types but calls:

```ts
const operationId = saveQueue.dispatch(command);
```

Creation forms may clear/close immediately after a successful local dispatch (`operationId !== null`). Drag frames remain direct Zustand updates; drag-stop dispatches the current position. Inspector remains explicit-save but its command is applied locally then queued. Board removal clears selection after local detach succeeds.

- [ ] **Step 4: Map asynchronous queue failures back to existing action-specific messages**

Track the latest failed operation ID already handled in a ref. On a new `snapshot.failedOperations` entry, map command type to the existing messages:

```ts
switch (failure.command.type) {
  case "create-node":
    setCreateError("Unable to create Node.");
    break;
  case "move-node":
    setPositionError("Unable to save Node position.");
    break;
  case "create-edge":
    setRelationshipError("Unable to create Relationship.");
    break;
  case "update-node":
    setInspectorError(
      isAxiosError(failure.error) && failure.error.response?.status === 409
        ? "This Node changed elsewhere. Reload before saving again."
        : "Unable to save Node.",
    );
    break;
  case "update-edge":
    setInspectorError(
      isAxiosError(failure.error) && failure.error.response?.status === 409
        ? "This Relationship changed elsewhere. Reload before saving again."
        : "Unable to save Relationship.",
    );
    break;
  case "remove-board-node":
    setInspectorError("Unable to remove Node from Board.");
    break;
  case "remove-board-edge":
    setInspectorError("Unable to remove Relationship from Board.");
    break;
}
```

Do not restore failed local changes. Update failure tests accordingly: a failed create stays visible, a failed move keeps latest position, and a failed Board detach stays detached until retry succeeds.

- [ ] **Step 5: Render the aggregate save indicator in the Board header**

Use accessible text and one Retry button:

```tsx
<div aria-live="polite" className="text-sm text-neutral-500">
  {saveQueue.snapshot.saveState === "saved" ? "Saved" : null}
  {saveQueue.snapshot.saveState === "saving" ? "Saving…" : null}
  {saveQueue.snapshot.saveState === "unsaved" ? "Unsaved" : null}
  {saveQueue.snapshot.saveState === "error" ? (
    <span>
      Error
      <button type="button" onClick={saveQueue.retryFailed}>Retry</button>
    </span>
  ) : null}
</div>
```

Do not derive this indicator from TanStack `isPending` flags.

- [ ] **Step 6: Preserve per-entity Inspector busy UX with queue lane state**

For the selected Node/Edge, derive its lane and pass `isSaving` when that lane is `pending` or `saving`; use lane state rather than global mutation pending flags. Removal is local/immediate, so `isRemoving` only needs to cover the current selected lane if the Inspector remains mounted.

- [ ] **Step 7: Run all focused Graph Editor frontend tests**

Run:

```bash
pnpm test -- \
  src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-page.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx
```

Expected: PASS with queue-aware failure semantics and unchanged same-Board hydration guard.

- [ ] **Step 8: Run architecture/type/unit gate**

Run:

```bash
pnpm check
```

Expected: PASS. Confirm no command/queue module imports React Flow, Axios, backend, Drizzle, or database code.

- [ ] **Step 9: Commit Task 4**

```bash
git add src/frontend/pages/graph-editor src/frontend/features/graph-editor
git commit -m "feat: route graph editor writes through save queue"
```

---

### Task 5: Record the concrete Save Queue architecture and verify critical persistence flow

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`
- Modify if required: `tests/e2e/auth-story.spec.ts`
- Read: `tests/AGENTS.md`

**Interfaces:**
- Architecture doc records the implemented entity-lane queue semantics without changing core domain ownership.
- E2E retains `edit → saved → reload → verify` and waits on the visible `Saved` state before reload when the queue is involved.

- [ ] **Step 1: Update architecture documentation with only implemented rules**

Add concise bullets under Graph editor persistence/editing:

```text
- Save Queue serializes durable writes per `node:<id>` / `edge:<id>` lane.
- Pending not-yet-started Node moves coalesce to the latest position.
- Failed lanes preserve Zustand working state, expose Error, and resume only through explicit Retry.
- Durable responses must not overwrite newer working values.
- Save indicator states are Saved / Saving / Unsaved / Error.
```

Do not add Inspector autosave, undo/redo, realtime, or cross-entity dependency scheduling as implemented features.

- [ ] **Step 2: Add/adjust E2E synchronization around visible Saved state**

Where the critical Graph Editor E2E currently performs a durable edit then reloads, wait for the header save indicator before reload:

```ts
await expect(page.getByText("Saved", { exact: true })).toBeVisible();
await page.reload();
```

Preserve explicit server-response synchronization where it is still needed for setup races; do not slow optimistic UI itself.

- [ ] **Step 3: Run critical E2E locally if the environment supports it**

Run the repository's existing E2E command from `package.json`, or rely on PR CI when the required PostgreSQL/browser services are CI-managed. Expected: Graph create/move/edit/remove flows persist and survive reload after `Saved` becomes visible.

- [ ] **Step 4: Commit Task 5**

```bash
git add docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md tests/e2e/auth-story.spec.ts
git commit -m "docs: record editor save queue architecture"
```

---

### Task 6: Full verification, direct review, and Draft PR evidence

**Files:**
- No production scope expansion expected.
- Update PR body only with observed verification evidence.

**Interfaces:**
- Exact feature head must be verified before integration.
- PR remains Draft; merge is a separate integration decision.

- [ ] **Step 1: Run the full CI-equivalent gate**

Run:

```bash
pnpm check
pnpm test:integration
pnpm build
```

Run the repository E2E command when available. Verify tracked files are clean after generated steps using the same clean-tree check as CI.

Expected: all commands PASS.

- [ ] **Step 2: Open a Draft PR from `feat/editor-save-queue-v1` to `main`**

PR scope must explicitly list:
- command local/durable phase split,
- entity-lane Save Queue,
- Move coalescing,
- manual Retry and failure preservation,
- stale reconcile protection,
- visible four-state save indicator,
- Inspector autosave/undo/realtime deferred.

- [ ] **Step 3: Inspect the actual PR CI run for the exact head**

Record exact counts/results for:
- migrations,
- AGENTS/import boundaries,
- ESLint,
- TypeScript,
- unit tests,
- PostgreSQL integration,
- production build,
- clean-tree,
- Playwright including flaky markers.

Do not report success while any required job is pending or only a stale earlier head passed.

- [ ] **Step 4: Directly review the final diff against invariants**

Verify:
- no frontend backend/DB imports,
- queue core is framework-independent,
- same-Board hydration guard is unchanged,
- failed local state is not rolled back,
- same-lane ordering and cross-lane independence match tests,
- Move coalescing never mutates a running operation,
- stale persisted position cannot snap current working state backward,
- Board removal still never deletes canonical Node/Edge,
- no Inspector autosave, undo/redo, realtime, CRDT, event sourcing, schema, or migration scope creep.

Fix Critical/Important findings and rerun verification before calling the slice complete.

- [ ] **Step 5: Update Draft PR body with RED/GREEN and final evidence**

Include the initial focused RED failure, task-level GREEN checkpoints, final exact head SHA, CI run ID, test counts, direct review outcome, and explicit note that merge is a separate integration decision.
