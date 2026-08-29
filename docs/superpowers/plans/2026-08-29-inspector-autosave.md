# Inspector Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace explicit Inspector Save with per-entity 500 ms autosave while preserving raw invalid JSON drafts, selection-switch drafts, Save Queue ordering/error semantics, and truthful global save state.

**Architecture:** Add a small vanilla Zustand Inspector Draft Store that owns raw `name / description / propertiesText` per `node:<id>` / `edge:<id>`. A framework-independent autosave controller subscribes to draft changes, keeps one debounce timer per entity, validates/normalizes the latest draft against the latest Graph Zustand entity, and dispatches existing `update-node` / `update-edge` commands into the existing Save Queue. React only adapts store/controller lifecycle and renders controlled Inspector inputs; Graph Zustand remains valid working graph state and the Save Queue remains the only durable write scheduler.

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, TanStack Query 5, Vitest 4, React Testing Library 16, Playwright 1.62, Next.js 16.

**Spec:** `docs/superpowers/specs/2026-08-29-inspector-autosave-design.md`

## Global Constraints

- Autosave delay is exactly **500 ms after the latest draft edit**.
- Inspector drafts are keyed by `node:<nodeId>` / `edge:<edgeId>` and survive selection changes for the mounted Board editor session.
- Raw invalid/unfinished JSON may exist only in Inspector Draft state; invalid text must never enter Graph Zustand, EditorCommand, TanStack mutation payloads, or the backend.
- Graph Zustand contains only valid Node/Edge working values; Save Queue remains the only durable editor write scheduler.
- `update-node` / `update-edge` command shapes and Save Queue lane rules remain unchanged.
- Do not disable Inspector typing while persistence is pending or failed.
- Persistence/version responses must never replace the visible raw draft.
- No explicit canonical Save button remains in Inspector.
- `Remove from Board` remains explicit and keeps canonical Story Node/Edge data.
- Save indicator must never show `Saved` while any Inspector draft contains unsaved/invalid user input.
- Existing `409` messages and explicit queue `Retry` semantics remain; no automatic conflict merge or background retry is added.
- Structural JSON equality is semantic: object key order and whitespace alone do not create canonical changes.
- No backend endpoint, contract, schema, migration, undo/redo, realtime, CRDT/Yjs, event sourcing, or offline-refresh draft persistence changes.
- Frontend never imports backend/Drizzle/DB; same-Board hydration guard remains intact.

---

## File Structure Lock

Create:

```text
src/frontend/features/graph-editor/inspector/
├─ inspector-draft-store.ts
├─ inspector-draft-store.test.ts
├─ inspector-draft-model.ts
├─ inspector-draft-model.test.ts
├─ inspector-autosave-controller.ts
├─ inspector-autosave-controller.test.ts
├─ use-inspector-autosave.ts
└─ use-inspector-autosave.test.tsx
```

Modify:

```text
src/frontend/features/graph-editor/inspector/graph-inspector.tsx
src/frontend/pages/graph-editor/graph-editor-page.tsx
src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx
src/frontend/features/graph-editor/AGENTS.md
docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
tests/e2e/auth-story.spec.ts
```

Responsibilities:

- `inspector-draft-model.ts`: pure draft identity, initialization, validation, semantic comparison, dirty/saveable evaluation, command-input normalization.
- `inspector-draft-store.ts`: raw per-entity draft ownership and revisioned updates only.
- `inspector-autosave-controller.ts`: per-entity 500 ms scheduling; no React imports.
- `use-inspector-autosave.ts`: React lifecycle adapter for the controller and draft-store subscription helper(s).
- `graph-inspector.tsx`: controlled inputs + validation/conflict UI; no save timer, persistence, or local canonical copy.
- `graph-editor-page.tsx`: composition only: initialize drafts from selected canonical entities, connect autosave to Save Queue dispatch, compose queue + draft save state.

---

### Task 1: Add pure Inspector draft model and per-entity Draft Store

**Files:**
- Create: `src/frontend/features/graph-editor/inspector/inspector-draft-model.ts`
- Create: `src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts`
- Create: `src/frontend/features/graph-editor/inspector/inspector-draft-store.ts`
- Create: `src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts`
- Read: `src/contracts/graph/graph.contract.ts`
- Read: `src/frontend/features/graph-editor/model/editor-types.ts`

**Interfaces:**

```ts
export type InspectorEntityKey = `node:${string}` | `edge:${string}`;

export type InspectorDraft = {
  name: string;
  description: string;
  propertiesText: string;
  revision: number;
};

export type InspectorDraftPatch = Partial<
  Pick<InspectorDraft, "name" | "description" | "propertiesText">
>;

export type InspectorCanonicalEntity = GraphNodeResponse | GraphEdgeResponse;

export type InspectorDraftEvaluation =
  | {
      status: "saveable";
      dirty: boolean;
      input: {
        name: string;
        description: string;
        properties: Record<string, unknown>;
      };
    }
  | {
      status: "invalid";
      dirty: boolean;
      message:
        | "Name is required."
        | "Properties must be valid JSON."
        | "Properties must be a JSON object.";
    };

export function toInspectorEntityKey(
  kind: "node" | "edge",
  id: string,
): InspectorEntityKey;

export function createInspectorDraftFromEntity(
  entity: InspectorCanonicalEntity,
): InspectorDraft;

export function evaluateInspectorDraft(
  draft: InspectorDraft,
  entity: InspectorCanonicalEntity,
): InspectorDraftEvaluation;
```

Draft store:

```ts
export type InspectorDraftState = {
  drafts: Readonly<Record<InspectorEntityKey, InspectorDraft>>;
  ensureDraft(key: InspectorEntityKey, entity: InspectorCanonicalEntity): void;
  updateDraft(key: InspectorEntityKey, patch: InspectorDraftPatch): void;
};

export type InspectorDraftStore = StoreApi<InspectorDraftState>;
export function createInspectorDraftStore(): InspectorDraftStore;
```

- [ ] **Step 1: Write failing model tests**

```ts
it("initializes raw draft from canonical entity", () => {
  expect(createInspectorDraftFromEntity(alice)).toEqual({
    name: "Alice",
    description: "Protagonist",
    propertiesText: '{\n  "role": "lead"\n}',
    revision: 0,
  });
});

it("keeps incomplete JSON invalid and dirty without producing canonical input", () => {
  const draft = {
    ...createInspectorDraftFromEntity(alice),
    propertiesText: '{"role":"lead","job":',
    revision: 1,
  };

  expect(evaluateInspectorDraft(draft, alice)).toEqual({
    status: "invalid",
    dirty: true,
    message: "Properties must be valid JSON.",
  });
});
```

Add explicit cases for whitespace-only name, array, `null`, valid object, and valid values semantically equal to canonical properties.

- [ ] **Step 2: Write failing structural JSON equality tests**

A canonical `{ role: "lead", meta: { age: 31 } }` must be equal to raw JSON with reordered keys and different whitespace. Arrays remain order-sensitive. Do not use raw `JSON.stringify(a) === JSON.stringify(b)` for semantic comparison.

- [ ] **Step 3: Run the model tests and verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts
```

Expected: FAIL because the model module does not exist.

- [ ] **Step 4: Implement the minimal pure draft model**

Implement recursive JSON-value equality for primitives/arrays/plain objects, parse `propertiesText`, trim only `name`, preserve `description` exactly, and report `dirty` by comparing normalized saveable values to canonical Graph values. For invalid properties, compare raw draft values to canonical-derived draft values so unfinished user input is dirty.

- [ ] **Step 5: Run model tests and verify GREEN**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write failing Draft Store preservation tests**

```ts
const store = createInspectorDraftStore();
store.getState().ensureDraft("node:alice", alice);
store.getState().updateDraft("node:alice", { propertiesText: '{"job":' });
store.getState().ensureDraft("node:bob", bob);
store.getState().ensureDraft("node:alice", { ...alice, version: 99 });

expect(store.getState().drafts["node:alice"].propertiesText).toBe('{"job":');
```

Also assert:

```ts
const before = store.getState();
store.getState().updateDraft("node:missing", { name: "Ghost" });
expect(store.getState()).toBe(before);
```

`updateDraft()` for a missing key is explicitly a **no-op**. Every actual field update increments that entity draft's `revision`; `ensureDraft()` never overwrites an existing draft.

- [ ] **Step 7: Implement vanilla Zustand Draft Store**

Use `zustand/vanilla` like `graph-editor-store.ts`. Update only the targeted key and preserve all other entity drafts. `ensureDraft()` is idempotent and `updateDraft()` does nothing for missing keys.

- [ ] **Step 8: Run Draft Store/model tests and verify GREEN**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts \
  src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/frontend/features/graph-editor/inspector/inspector-draft-*.ts
git commit -m "feat: add inspector draft model"
```

---

### Task 2: Add framework-independent per-entity autosave controller

**Files:**
- Create: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.ts`
- Create: `src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts`
- Create: `src/frontend/features/graph-editor/inspector/use-inspector-autosave.ts`
- Create: `src/frontend/features/graph-editor/inspector/use-inspector-autosave.test.tsx`
- Read: `src/frontend/features/graph-editor/save-queue/use-editor-save-queue.ts`
- Read: `src/frontend/features/graph-editor/store/graph-editor-store.ts`
- Read: `src/frontend/features/graph-editor/commands/node-commands.ts`
- Read: `src/frontend/features/graph-editor/commands/edge-commands.ts`

**Interfaces:**

```ts
export type InspectorAutosaveController = {
  start(): void;
  dispose(): void;
};

export function createInspectorAutosaveController(input: {
  draftStore: InspectorDraftStore;
  graphStore: GraphEditorStore;
  boardId: string;
  workspaceId: string;
  delayMs?: number;
  dispatch(command: EditorCommand): string | null;
}): InspectorAutosaveController;
```

React adapter:

```ts
export function useInspectorAutosave(input: {
  draftStore: InspectorDraftStore;
  graphStore: GraphEditorStore;
  boardId: string;
  workspaceId: string | undefined;
  dispatch(command: EditorCommand): string | null;
}): void;

export function useInspectorDraftState(
  store: InspectorDraftStore,
): InspectorDraftState;
```

- [ ] **Step 1: Write failing 500 ms debounce tests with fake timers**

Use `vi.useFakeTimers()` and a real Draft Store/Graph Store.

```text
edit name -> 499 ms -> dispatch 0
+1 ms -> dispatch 1
```

Then edit three times inside one 500 ms window and assert only the latest normalized value is dispatched.

- [ ] **Step 2: Write failing per-entity timer independence test**

Edit Alice, advance 250 ms, edit Bob, advance 250 ms. Alice must dispatch at its own 500 ms deadline while Bob remains pending. This guarantees selection changes cannot cancel another entity's pending autosave.

- [ ] **Step 3: Write failing invalid/unchanged tests**

Assert invalid JSON, array/null properties, and whitespace-only name dispatch nothing. Valid JSON that differs only in whitespace/key order also dispatches nothing.

- [ ] **Step 4: Write failing Node/Edge command-shape tests**

Node expectation:

```ts
expect(dispatch).toHaveBeenCalledWith({
  type: "update-node",
  boardId,
  workspaceId,
  nodeId: alice.id,
  version: alice.version,
  name: "Alicia",
  description: "Main protagonist",
  properties: { role: "lead", age: 31 },
});
```

Edge expectation uses `type: "update-edge"`, `edgeId`, current edge version, and the same normalized fields.

- [ ] **Step 5: Run controller tests and verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 6: Implement one timer per entity key**

Subscribe to the Draft Store. Detect changed draft keys by object identity/revision. For each changed key, clear only that key's existing timer and schedule a new `setTimeout(..., delayMs ?? 500)`.

At timer execution, re-read the **latest** draft and **latest** Graph Zustand entity, call `evaluateInspectorDraft()`, and dispatch only when `status === "saveable" && dirty`.

Do not cache entity `version` when the timer is scheduled; resolve it at timer fire time. Existing Save Queue runtime still refreshes version immediately before durable PATCH.

- [ ] **Step 7: Write lifecycle/disposal tests and implement lifecycle**

Required assertions:

```text
start() twice -> one subscription
dispose() -> pending timers cleared
dispose() -> later draft changes do not dispatch
```

`start()` is idempotent. `dispose()` unsubscribes and clears every timer.

- [ ] **Step 8: Run controller tests and verify GREEN**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts
```

Expected: PASS.

- [ ] **Step 9: Write failing React StrictMode hook regression**

Follow the existing `useEditorSaveQueue` StrictMode test style:

```tsx
const { result } = renderHook(
  () => useInspectorAutosaveHarness(...),
  { wrapper: StrictMode },
);
```

After editing a draft and advancing 500 ms, assert exactly one dispatch. This test is mandatory because the Save Queue slice previously exposed a real `setup -> cleanup -> setup` disposal bug under React StrictMode.

- [ ] **Step 10: Run StrictMode test and verify RED**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/use-inspector-autosave.test.tsx
```

Expected: FAIL until the hook/controller lifecycle survives effect replay.

- [ ] **Step 11: Implement React lifecycle adapter**

Create/activate the controller so React StrictMode effect replay leaves the mounted hook live, while final unmount clears timers/subscriptions. Do not store render-time persistence objects in a React ref. `workspaceId === undefined` means no controller is active yet.

`useInspectorDraftState()` uses Zustand/`useStore` or `useSyncExternalStore` to rerender when raw drafts change.

- [ ] **Step 12: Run StrictMode + controller tests and verify GREEN**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts \
  src/frontend/features/graph-editor/inspector/use-inspector-autosave.test.tsx
```

Expected: PASS.

- [ ] **Step 13: Commit Task 2**

```bash
git add src/frontend/features/graph-editor/inspector/inspector-autosave-controller* \
        src/frontend/features/graph-editor/inspector/use-inspector-autosave*
git commit -m "feat: add inspector autosave controller"
```

---

### Task 3: Convert Inspector to controlled drafts and wire page autosave

**Files:**
- Modify: `src/frontend/features/graph-editor/inspector/graph-inspector.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`

**Interfaces:**

Replace `GraphInspectorSaveInput` / `onSave` with:

```ts
export function GraphInspector(props: {
  selection: GraphInspectorSelection;
  draft: InspectorDraft;
  validationError: string | null;
  error: string | null;
  isRemoving: boolean;
  isLaneBusy: boolean;
  onDraftChange(patch: InspectorDraftPatch): void;
  onRemoveFromBoard(): Promise<void> | void;
}): JSX.Element;
```

`isLaneBusy` disables only the explicit `Remove from Board` button. Name, Description, and Properties inputs remain enabled during pending/saving/error states.

- [ ] **Step 1: Convert existing Inspector tests to failing autosave expectations**

Use `vi.useFakeTimers()` and `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. Remove clicks on `Save Node` / `Save Relationship` and assert those buttons do not exist.

Node pattern:

```ts
await user.clear(screen.getByLabelText("Name"));
await user.type(screen.getByLabelText("Name"), "Alicia");
expect(mocks.updateNode).not.toHaveBeenCalled();
await vi.advanceTimersByTimeAsync(500);
await waitFor(() => expect(mocks.updateNode).toHaveBeenCalledTimes(1));
```

Repeat for Relationship.

- [ ] **Step 2: Add failing Alice -> Bob -> Alice invalid draft test**

```text
select Alice
set Properties JSON to {"job":
assert validation message + updateNode 0
select Bob
select Alice
assert exact {"job": still visible
```

This directly locks the approved UX.

- [ ] **Step 3: Add failing version-response no-reset test**

Make the first `updateNode` return version 4 while the user types a newer value after the first save starts. Resolve the first request and assert the visible input remains the newest raw draft. This prevents reintroducing the current `key=...version` remount bug.

- [ ] **Step 4: Run Inspector tests and verify RED**

```bash
pnpm test -- src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
```

Expected: FAIL because current Inspector still owns local form state and explicit Save.

- [ ] **Step 5: Refactor `GraphInspector` to controlled inputs**

Remove component-local form state, submit handler, `<form onSubmit>`, and canonical Save button.

```tsx
<input
  value={draft.name}
  onChange={(event) => onDraftChange({ name: event.target.value })}
/>
```

Do the same for description and `propertiesText`. Render validation message immediately from `validationError`; render queue/409 `error` separately.

Keep the visible `Version {selection.entity.version}` text, but never include version in the Inspector React `key`.

- [ ] **Step 6: Create a Board-scoped Draft Store in `GraphEditorContent`**

Use:

```ts
const draftStore = useMemo(() => createInspectorDraftStore(), [boardId]);
const draftState = useInspectorDraftState(draftStore);

useInspectorAutosave({
  draftStore,
  graphStore: store,
  boardId,
  workspaceId,
  dispatch: saveQueue.dispatch,
});
```

This explicitly resets drafts on Board change and prevents cross-Board leakage.

- [ ] **Step 7: Initialize/restore selected draft without overwrite**

When `inspectorSelection` exists, compute the stable entity key and call `ensureDraft()` only when that key is missing. Render the stored draft. Inspector key, if present, is stable identity only:

```tsx
key={`${inspectorSelection.kind}:${inspectorSelection.entity.id}`}
```

- [ ] **Step 8: Remove `handleSaveInspector()`**

Autosave controller now constructs `update-node` / `update-edge`. Page keeps selection, Board removal, Save Queue failure mapping, and graph rendering only.

- [ ] **Step 9: Compute immediate selected validation**

Call `evaluateInspectorDraft()` with selected raw draft + current canonical entity. Pass its invalid message immediately; validation is not delayed 500 ms.

- [ ] **Step 10: Run Inspector tests and verify GREEN**

```bash
pnpm test -- src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
```

Expected: PASS for Node autosave, Edge autosave, invalid JSON, selection restore, version-response preservation, and 409 draft preservation.

- [ ] **Step 11: Commit Task 3**

```bash
git add src/frontend/features/graph-editor/inspector/graph-inspector.tsx \
        src/frontend/pages/graph-editor/graph-editor-page.tsx \
        src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
git commit -m "feat: autosave inspector drafts"
```

---

### Task 4: Make global save state truthful and preserve failure/removal behavior

**Files:**
- Modify: `src/frontend/features/graph-editor/inspector/inspector-draft-model.ts`
- Modify: `src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts`
- Modify: `src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Verify: `src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx`
- Verify: `src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx`
- Verify: `src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx`

**Interfaces:**

```ts
export function combineEditorSaveState(
  queueState: SaveState,
  hasDirtyInspectorDraft: boolean,
): SaveState {
  if (queueState === "error") return "error";
  if (queueState === "saving") return "saving";
  if (queueState === "unsaved") return "unsaved";
  return hasDirtyInspectorDraft ? "unsaved" : "saved";
}
```

Dirty summary evaluates **all existing drafts**, not only the selected entity, against current Graph Zustand entities.

- [ ] **Step 1: Write failing pure combined-state tests**

Cover:

```text
saved + clean -> saved
saved + dirty -> unsaved
unsaved + dirty -> unsaved
saving + dirty -> saving
error + dirty -> error
```

- [ ] **Step 2: Write failing page test for invalid unselected draft**

```text
initial -> Saved
select Alice -> type invalid JSON -> Unsaved
select Bob -> still Unsaved
updateNode remains 0
return Alice -> exact invalid draft remains
fix JSON -> debounce -> Saving… -> Saved after durable success
```

This protects the design correction that Save Queue alone cannot represent invalid draft state.

- [ ] **Step 3: Write failing 409/failure typing test**

Make first autosave return 409. Assert:

```text
header Error + Retry
Inspector conflict message visible
current draft preserved
further typing still changes input
```

Further valid typing may enqueue later same-lane operations, but existing Save Queue semantics keep them behind the failed operation until Retry.

- [ ] **Step 4: Implement all-draft dirty summary + combined state**

For each draft key, resolve the corresponding current Graph Zustand Node/Edge and evaluate it. A Board detach leaves canonical Node/Edge present, so its draft remains evaluable. If a draft key has no canonical entity, count it dirty and do not autosave it.

Render header from `combinedSaveState`; Retry visibility/action remains tied to actual Save Queue error state.

- [ ] **Step 5: Verify Board removal and failure tests**

Run existing tests unchanged first. Required behavior:

```text
Board Node/Edge removal stays explicit
canonical Story Node/Edge remains
selected Inspector clears when current behavior clears it
failed removal preserves local detached working state + Retry
raw draft is not converted into canonical data
```

Only modify these tests if selectors/props changed due the Inspector refactor; do not alter their semantics.

- [ ] **Step 6: Run focused regressions and verify GREEN**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts \
  src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/frontend/features/graph-editor/inspector/inspector-draft-model* \
        src/frontend/pages/graph-editor
git commit -m "feat: include inspector drafts in save state"
```

---

### Task 5: Update E2E, architecture instructions, and run full verification

**Files:**
- Modify: `tests/e2e/auth-story.spec.ts`
- Modify: `src/frontend/features/graph-editor/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`
- Read/verify: `docs/superpowers/specs/2026-08-29-inspector-autosave-design.md`

- [ ] **Step 1: Change Graph Inspector E2E from click-Save to autosave response**

In `Graph Editor edits canonical Node and Relationship data through the Inspector`, remove Save-button interactions. Install `page.waitForResponse()` before the final edit and await the canonical PATCH.

Node pattern:

```ts
const nodeUpdatePromise = page.waitForResponse((response) => {
  const path = new URL(response.url()).pathname;
  return (
    response.request().method() === "PATCH" &&
    path === `/api/v1/nodes/${aliceId}`
  );
});

await page.getByLabel("Name").fill("Alicia");
await page.getByLabel("Description").fill("Main protagonist");
await page.getByLabel("Properties JSON").fill('{"role":"lead","age":31}');

const nodeUpdate = await nodeUpdatePromise;
expect(nodeUpdate.status()).toBe(200);
await expect(page.getByText("Saved")).toBeVisible();
```

Repeat for Relationship PATCH. Reload and verify durable canonical values through the existing UI/snapshot assertions.

- [ ] **Step 2: Add E2E invalid-draft UX assertion**

Within the Inspector E2E, type incomplete JSON and assert both:

```text
Properties must be valid JSON.
Unsaved
```

Then complete valid JSON, await the PATCH response, assert `Saved`, reload, and verify the durable value. Unit/component tests remain responsible for the exact 500 ms no-request timing assertion; E2E does not use arbitrary sleeps.

- [ ] **Step 3: Update Graph Editor AGENTS invariant**

Add exactly one concise rule:

```md
- Inspector raw/invalid 입력은 draft state가 소유하고 canonical Zustand에는 valid 값만 둔다.
```

Do not create another AGENTS boundary under `inspector/`.

- [ ] **Step 4: Synchronize architecture design**

Record the concrete flow:

```text
Inspector typing
  -> per-entity Inspector Draft Store
  -> 500 ms debounce + validation
  -> update-node/update-edge Command
  -> valid Graph Zustand working state
  -> Save Queue
  -> HTTP/API/PostgreSQL
```

Also state that dirty/invalid draft contributes `Unsaved` to visible editor status and invalid raw JSON never enters canonical Graph state.

- [ ] **Step 5: Run focused unit/component suite**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts \
  src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts \
  src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts \
  src/frontend/features/graph-editor/inspector/use-inspector-autosave.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit docs/E2E changes**

```bash
git add tests/e2e/auth-story.spec.ts \
        src/frontend/features/graph-editor/AGENTS.md \
        docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
git commit -m "test: verify inspector autosave workflow"
```

- [ ] **Step 7: Run repository verification**

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

Run the clean-tree check in the same committed/staged state used by repository CI. Do not claim completion from a partial command set.

Expected acceptance evidence:

```text
AGENTS validation PASS
import-boundary validation PASS
ESLint PASS
TypeScript PASS
all unit PASS
all integration PASS
production build PASS
tracked/generated tree clean
Playwright critical Graph Editor flows PASS
```

- [ ] **Step 8: Direct diff review against `main`**

Review specifically for:

```text
no backend/schema/migration changes
no Graph Zustand raw invalid JSON
no query-cache editor draft ownership
no explicit Inspector Save button
no input disabling while save pending/error
no entity.version React key reset
no debounce cancellation when selection changes
no false Saved with dirty drafts
no automatic retry/conflict merge
Board detach remains presentation-only
same-Board hydration guard remains
```

Fix Critical/Important findings with a regression test before declaring the slice complete.

- [ ] **Step 9: Open a Draft PR after verification evidence is available**

PR summary must include:

```text
exact feature head SHA
500 ms debounce behavior
per-entity draft preservation behavior
invalid JSON behavior
dirty draft + queue combined save-state behavior
409/Retry behavior
unit/integration/E2E counts
architecture boundary review
```

Do not merge automatically. Integration remains a separate user decision.

---

## Plan Self-Review Checklist

- Spec coverage: explicit Save removal, 500 ms debounce, Node + Edge, invalid raw JSON isolation, Alice -> Bob -> Alice restoration, version-response no reset, typing during pending/failure, 409, Retry, truthful save indicator, Board removal, E2E reload verification all map to concrete tasks.
- Dependency boundary: Draft Store imports no Save Queue/TanStack/React Flow; autosave controller uses Graph Store + Draft Store + command dispatch only; Graph Inspector stays UI-only.
- Timer boundary: timers are per entity, so selection changes never cancel another entity's scheduled autosave.
- Save-state boundary: dirty is calculated across all drafts, not only the selected draft.
- Lifecycle boundary: React StrictMode regression coverage is mandatory before hook completion.
- Type consistency: Node/Edge autosave emits existing `UpdateNodeCommand` / `UpdateEdgeCommand` fields exactly.
- Scope: no backend/schema/contracts/general dependency scheduler/undo/realtime work.
- No placeholders: missing-key behavior, busy-state behavior, Version behavior, StrictMode behavior, tests, commands, and acceptance checks are explicit.
