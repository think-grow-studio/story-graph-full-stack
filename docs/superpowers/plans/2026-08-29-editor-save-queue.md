# Editor Save Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all Graph Editor durable writes through an entity-lane Save Queue while keeping Zustand working state immediate, preserving failed local edits, coalescing pending Node moves, and showing `Saved / Saving / Unsaved / Error` state.

**Architecture:** Split command handling into immediate local apply and durable persist/reconcile. A framework-independent queue serializes commands per Node/Edge lane, coalesces only not-yet-started Node moves, pauses failed lanes until manual retry, and allows unrelated lanes to progress. One narrow cross-lane rule prevents `create-edge` from persisting before any still-active `create-node` for its source/target IDs; this covers the concrete FK race without building a general dependency scheduler.

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, TanStack Query 5, Vitest 4, React Testing Library, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-08-29-editor-save-queue-design.md`

## Global Constraints

- PostgreSQL = durable truth; TanStack Query = fetched/cache/mutation lifecycle; Zustand = editor working state; React Flow = rendering/input only.
- Frontend never imports backend/Drizzle/DB; durable access remains behind `EditorPersistence` and `/api/v1`.
- Board = View; canonical Node/Edge remain Story-owned.
- Local editor changes happen before persistence waits.
- Same-entity commands are durably ordered; unrelated lanes may progress independently.
- Only pending, not-yet-started `move-node` commands for the same Node may coalesce.
- `create-edge` waits for still-active `create-node` operations for its source/target Node IDs; no other general dependency scheduler is added.
- Failure keeps working state and stops only the failed lane; retry is explicit/manual and finite.
- Inspector remains explicit-save; debounce/autosave, invalid intermediate JSON drafts, undo/redo, realtime, CRDT, event sourcing, background queues, schema/migration changes are deferred.
- Same-Board Query cache changes must not full-hydrate Zustand.

---

### Task 1: Split command local apply from durable persistence/reconcile

**Files:**
- Create: `src/frontend/features/graph-editor/commands/editor-command-runtime.ts`
- Create: `src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command-executor.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command-executor.test.ts`
- Read: `src/frontend/features/graph-editor/store/graph-editor-store.ts`
- Read: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`

**Interfaces:**

```ts
export function applyEditorCommand(
  store: GraphEditorStore,
  command: EditorCommand,
): boolean;

export async function persistAndReconcileEditorCommand(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  command: EditorCommand,
): Promise<void>;
```

`false` from `applyEditorCommand()` means the local target did not exist, so nothing should be queued.

- [ ] **Step 1: Write RED local-apply/failure tests**

```ts
it("keeps a locally created Node when durable create fails", async () => {
  const store = hydratedStore();
  const durable = persistence();
  const command = createNodeCommand();

  expect(applyEditorCommand(store, command)).toBe(true);
  vi.mocked(durable.createNode).mockRejectedValue(new Error("offline"));

  await expect(
    persistAndReconcileEditorCommand(store, durable, command),
  ).rejects.toThrow("offline");

  expect(store.getState().nodes.some((node) => node.id === command.nodeId)).toBe(true);
});
```

Add equivalent assertions for `update-node`, `update-edge`, `remove-board-node`, and `remove-board-edge`: local state changes immediately and durable failure does not roll it back.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
```

Expected: FAIL because the runtime module does not exist.

- [ ] **Step 3: Implement immediate local application**

Use existing store methods. `create-*` adds optimistic pairs, `move-node` sets position, updates replace editable fields while keeping the current version, and Board removals detach presentation only.

```ts
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
```

Move the existing optimistic Node/Edge pair builders into this runtime or a focused command helper; do not duplicate them.

- [ ] **Step 4: Write RED stale-reconcile/version tests**

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

Also test delayed `create-node` reconcile preserving a newer local position, and two queued Node/Edge updates using the version returned by the earlier same-lane save.

- [ ] **Step 5: Implement guarded persistence/reconcile**

Immediately before `update-node`/`update-edge` persistence, derive a command using the latest local canonical `version`. Reconcile server-owned metadata/version while preserving working fields that have changed since the acknowledged command.

For `move-node`, if the current BoardNode position no longer equals `command.position`, merge the persisted response with the current `x/y` rather than replacing them. For delayed `create-node`, preserve the current local BoardNode position when it differs from the original create position. Removal success performs no local mutation because detach already happened.

- [ ] **Step 6: GREEN runtime tests**

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7: Rebase the compatibility executor on the new runtime**

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

Update `editor-command-executor.test.ts` to the new no-rollback semantics until Task 4 removes page dependence on this helper.

- [ ] **Step 8: Commit**

```bash
git add src/frontend/features/graph-editor/commands
git commit -m "refactor: split editor command runtime phases"
```

---

### Task 2: Build the framework-independent Save Queue

**Files:**
- Create: `src/frontend/features/graph-editor/save-queue/save-state.ts`
- Create: `src/frontend/features/graph-editor/save-queue/editor-save-queue.ts`
- Create: `src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts`
- Read: `src/frontend/features/graph-editor/commands/editor-command.ts`

**Interfaces:**

```ts
export type SaveState = "saved" | "saving" | "unsaved" | "error";

export type FailedEditorOperation = {
  operationId: string;
  attempt: number;
  laneKey: string;
  command: EditorCommand;
  error: unknown;
};

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

export function getEditorCommandLaneKey(command: EditorCommand): string;

export function createEditorSaveQueue(input: {
  execute(command: EditorCommand): Promise<void>;
  createOperationId?: () => string;
}): EditorSaveQueue;
```

Node lane key = `node:${nodeId}`. Edge lane key = `edge:${edgeId}`. Snapshot objects are cached and replaced only on queue changes so `useSyncExternalStore` receives stable snapshots.

- [ ] **Step 1: Write RED save-state/FIFO/independence tests**

Use deferred promises. Assert `saved → unsaved → saving → saved`, same-lane FIFO, and Node A failure not blocking Edge B.

```ts
queue.enqueue(moveNodeCommand(aliceId, 100));
expect(queue.getSnapshot().saveState).toBe("unsaved");
await flushMicrotasks();
expect(queue.getSnapshot().saveState).toBe("saving");
```

- [ ] **Step 2: Run RED**

```bash
pnpm test -- src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts
```

Expected: FAIL because queue modules do not exist.

- [ ] **Step 3: Implement lanes and aggregate state**

Each lane has one running operation, ordered pending operations, and at most one failed head. Start processing with `queueMicrotask()` so enqueue exposes `unsaved` before `saving`.

Aggregate priority is exact:

```ts
error > saving > unsaved > saved
```

Notify subscribers on every queue transition.

- [ ] **Step 4: Write RED Move coalescing tests**

```ts
queue.enqueue(moveNodeCommand(aliceId, 100));
await flushMicrotasks(); // 100 is running
queue.enqueue(moveNodeCommand(aliceId, 120));
queue.enqueue(moveNodeCommand(aliceId, 180));
```

After the first gate resolves, assert only `100` then `180` execute. Add a barrier case `move 120 → update-node → move 180` and assert neither Move is removed across the non-Move command.

- [ ] **Step 5: Implement pending-tail Move coalescing**

Only replace a pending `move-node` in the same lane after the most recent non-Move barrier. Never mutate a running or failed operation.

- [ ] **Step 6: Write RED failure/retry tests**

Assert:

```text
lane A fails -> error
later A stays pending
lane B still completes
retryFailed() -> failed A reattempts first
second failure increments FailedEditorOperation.attempt
success -> later A continues -> saved
```

- [ ] **Step 7: Implement manual retry**

A rejection stays as the lane's failed head. Do not auto-retry. `retryFailed()` re-arms every failed lane and schedules it. Increment `attempt` each time the same operation fails so the UI can distinguish repeated failures.

- [ ] **Step 8: Write RED Node-create dependency tests for Edge creation**

This is the narrow cross-lane rule required by the actual Editor workflow:

```ts
const nodeCreate = queue.enqueue(createNodeCommand(aliceId));
await flushMicrotasks(); // Node create running
queue.enqueue(createEdgeCommand(edgeId, aliceId, bobId));

expect(execute).toHaveBeenCalledTimes(1); // only create-node
```

After Node create succeeds, assert `create-edge` starts. If Node create fails, assert Edge remains pending and does not execute; after Retry succeeds, Edge runs. Repeat with both source and target having active creates and require both to succeed first.

- [ ] **Step 9: Implement the narrow dependency rule**

Track active `create-node` operation IDs by `nodeId` until they succeed. When enqueueing `create-edge`, capture any active source/target create IDs as dependencies. An Edge operation is runnable only after its captured dependencies have succeeded. Failed Node creates remain active blockers until manual retry succeeds. Do not add arbitrary dependency graphs for other command types.

- [ ] **Step 10: GREEN queue tests**

```bash
pnpm test -- src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts
```

Expected: PASS for state transitions, FIFO, cross-lane independence, Move coalescing, manual retry, and Node-create→Edge-create ordering.

- [ ] **Step 11: Commit**

```bash
git add src/frontend/features/graph-editor/save-queue
git commit -m "feat: add editor entity save queue"
```

---

### Task 3: Add the Board-scoped React queue hook

**Files:**
- Create: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.ts`
- Create: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx`
- Modify: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Read: `src/frontend/features/graph-editor/store/graph-editor-store-provider.tsx`

**Interfaces:**

```ts
export type UseEditorSaveQueueResult = {
  dispatch(command: EditorCommand): string | null;
  retryFailed(): void;
  snapshot: EditorSaveQueueSnapshot;
  getLaneState(commandOrLaneKey: EditorCommand | string):
    | "idle"
    | "pending"
    | "saving"
    | "error";
};

export function useEditorSaveQueue(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  boardId: string,
): UseEditorSaveQueueResult;
```

- [ ] **Step 1: Write RED hook test**

Render a hook harness with a real vanilla store and deferred mocked persistence. After `dispatch(move-node)`, assert the store position changes synchronously before persistence resolves, then snapshot reaches `saving`, then `saved`.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement with `useSyncExternalStore`**

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
```

`dispatch()` calls `applyEditorCommand()` first and enqueues only when it returns true. Dispose the queue when the Board-scoped instance is replaced/unmounted.

- [ ] **Step 4: Remove per-mutation pending state from persistence adapter**

Search current branch consumers of `useEditorPersistence`. After Task 4 is prepared to use lane state, change the adapter return to:

```ts
return { persistence };
```

Do not move TanStack cache synchronization out of existing graph mutation hooks.

- [ ] **Step 5: GREEN focused tests**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/commands/editor-command-runtime.test.ts \
  src/frontend/features/graph-editor/save-queue/editor-save-queue.test.ts \
  src/frontend/features/graph-editor/save-queue/use-editor-save-queue.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/frontend/features/graph-editor/save-queue src/frontend/features/graph-editor/persistence
git commit -m "feat: connect editor save queue to persistence"
```

---

### Task 4: Route the Editor page through the queue and render save state

**Files:**
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Create: `src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx`

**Interfaces:**
- Page uses `saveQueue.dispatch(command)` for all seven write types.
- Header derives only from `saveQueue.snapshot.saveState`.
- Retry button calls `saveQueue.retryFailed()`.
- Existing form validation and conflict-specific wording stay in the page.

- [ ] **Step 1: Write RED save-indicator/Retry tests**

Verify exact states `Saved`, `Unsaved`, `Saving…`, `Error`, plus a `Retry` button in error state. Reject a deferred persistence call, click Retry, resolve the retry, and assert the indicator returns to `Saved`.

- [ ] **Step 2: Run RED**

```bash
pnpm test -- src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx
```

Expected: FAIL because the page has no generic save indicator and still calls the executor directly.

- [ ] **Step 3: Replace direct executor calls**

```ts
const { persistence } = useEditorPersistence(workspaceId, boardId);
const saveQueue = useEditorSaveQueue(store, persistence, boardId);
```

Each handler constructs the same command but calls `saveQueue.dispatch(command)`. Creation forms clear/close when dispatch returns an operation ID. Drag frames stay direct Zustand updates; drag-stop dispatches the current BoardNode position. Inspector remains explicit-save. Board removal clears selection after local detach dispatch succeeds.

- [ ] **Step 4: Map queue failures to existing action messages**

Track the last handled failure key as `${operationId}:${attempt}`. On a new failed operation map command type to the existing messages. Preserve current 409 messages with `isAxiosError(failure.error)` for `update-node` and `update-edge`.

Do not restore local state. Update failure tests so failed create remains visible, failed move keeps its latest position, and failed Board detach stays detached while the header shows Error/Retry.

- [ ] **Step 5: Render header save indicator**

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

Do not derive this state from TanStack `isPending`.

- [ ] **Step 6: Preserve Inspector busy UX with lane state**

For selected Node/Edge, use `getLaneState()` and pass `isSaving=true` for `pending` or `saving`. Do not globally disable Inspector because another entity is saving.

- [ ] **Step 7: GREEN focused page regressions**

```bash
pnpm test -- \
  src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-page.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx
```

Expected: PASS, including unchanged one-time-per-Board hydration behavior.

- [ ] **Step 8: Run architecture/type/unit gate**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/frontend/pages/graph-editor src/frontend/features/graph-editor
git commit -m "feat: route graph editor writes through save queue"
```

---

### Task 5: Document concrete queue semantics and synchronize E2E on Saved

**Files:**
- Modify: `docs/superpowers/specs/2026-08-29-editor-save-queue-design.md`
- Modify: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`
- Modify: `tests/e2e/auth-story.spec.ts`
- Read: `tests/AGENTS.md`

- [ ] **Step 1: Record the narrow Node-create→Edge-create dependency in the Save Queue spec**

Add the implemented rule: a queued `create-edge` waits for still-active `create-node` operations for its source/target IDs; this is intentionally not a general cross-entity dependency scheduler.

- [ ] **Step 2: Record implemented architecture rules**

Add only these concrete bullets to the architecture persistence section:

```text
- durable writes serialize per node:<id> / edge:<id> lane
- pending not-yet-started Node moves coalesce
- create-edge waits for active source/target create-node operations
- failed lanes preserve working state and resume only through explicit Retry
- stale durable responses cannot overwrite newer working values
- visible state is Saved / Saving / Unsaved / Error
```

- [ ] **Step 3: Update critical E2E to wait for Saved before reload**

At durable Graph Editor checkpoints:

```ts
await expect(page.getByText("Saved", { exact: true })).toBeVisible();
await page.reload();
```

Keep existing explicit POST/PATCH response waits that prevent setup races.

- [ ] **Step 4: Run E2E**

```bash
pnpm e2e
```

Expected: critical Graph Editor workflows save and survive reload; no flaky marker is acceptable.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs tests/e2e/auth-story.spec.ts
git commit -m "docs: record editor save queue architecture"
```

---

### Task 6: Full verification, direct review, and Draft PR

**Files:**
- No production scope expansion beyond failures found by verification.

- [ ] **Step 1: Full local/CI-equivalent gate**

```bash
pnpm check
pnpm test:integration
pnpm build
pnpm e2e
```

Expected: PASS. Also confirm tracked-file clean-tree using the repository CI's existing `git diff --exit-code` check.

- [ ] **Step 2: Open Draft PR**

Create Draft PR `feat/editor-save-queue-v1 → main`. Body lists command phase split, queue lanes, Move coalescing, Node-create→Edge-create dependency, manual Retry, stale reconcile protection, four-state indicator, and explicit deferrals.

- [ ] **Step 3: Inspect exact-head PR CI**

Record exact results/counts for migrations, AGENTS/import boundaries, ESLint, TypeScript, unit, PostgreSQL integration, build, clean-tree, Playwright, and flaky markers. Do not use an older passing head.

- [ ] **Step 4: Direct diff review**

Verify all of the following before completion:

```text
no frontend backend/DB imports
queue core has no React/React Flow/Axios imports
same-Board hydration guard remains
failure never rolls working state back
same-lane FIFO and unrelated-lane independence match tests
running Move is never mutated by coalescing
create-edge cannot outrun active source/target create-node
stale persistence cannot snap working values backward
Board detach never deletes canonical Node/Edge
no Inspector autosave / undo / realtime / CRDT / event sourcing / schema scope creep
```

Fix Critical/Important findings and rerun verification.

- [ ] **Step 5: Update Draft PR evidence**

Include focused RED evidence, GREEN checkpoints, exact final head SHA, CI run ID/test counts, direct-review result, and state explicitly that merge is a separate integration decision.
