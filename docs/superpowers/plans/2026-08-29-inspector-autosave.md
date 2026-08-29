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
└─ use-inspector-autosave.ts
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
      message: "Name is required." | "Properties must be valid JSON." | "Properties must be a JSON object.";
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

- [ ] **Step 1: Write RED model tests**

Cover exact initialization and validation:

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

Add cases for whitespace-only name, array, `null`, valid object, and valid values semantically equal to canonical properties.

- [ ] **Step 2: Write RED structural JSON equality tests**

A canonical `{ role: "lead", meta: { age: 31 } }` must be equal to raw JSON with reordered keys and different whitespace. Arrays remain order-sensitive. Do not use raw `JSON.stringify(a) === JSON.stringify(b)` because object key order would create false changes.

- [ ] **Step 3: Run RED model tests**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts
```

Expected: FAIL because the model module does not exist.

- [ ] **Step 4: Implement minimal pure model**

Implement recursive JSON-value equality for primitives/arrays/plain objects, parse `propertiesText`, trim only `name`, preserve `description` exactly, and report `dirty` by comparing normalized saveable values to canonical Graph values. For invalid properties, `dirty` is true when raw draft differs from canonical-derived raw values or name/description differ from canonical.

- [ ] **Step 5: GREEN model tests**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write RED Draft Store selection-preservation tests**

```ts
const store = createInspectorDraftStore();
store.getState().ensureDraft("node:alice", alice);
store.getState().updateDraft("node:alice", { propertiesText: '{"job":' });
store.getState().ensureDraft("node:bob", bob);
store.getState().ensureDraft("node:alice", { ...alice, version: 99 });

expect(store.getState().drafts["node:alice"].propertiesText).toBe('{"job":');
```

Also assert every real field edit increments `revision`, `ensureDraft` never overwrites an existing draft, and updating a missing key is a no-op/error according to one explicit implementation rule; prefer no-op to avoid manufacturing drafts without canonical initialization.

- [ ] **Step 7: Implement vanilla Zustand Draft Store**

Use `zustand/vanilla` like `graph-editor-store.ts`. Update only the targeted key and preserve all other entity drafts. `ensureDraft()` must be idempotent.

- [ ] **Step 8: GREEN Draft Store tests**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts \
  src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

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

- [ ] **Step 1: Write RED debounce tests with fake timers**

Use `vi.useFakeTimers()` and a real Draft Store/Graph Store. Test:

```text
edit name -> 499 ms -> dispatch 0
+1 ms -> dispatch 1
```

Then edit three times inside one 500 ms window and assert only the latest normalized value is dispatched.

- [ ] **Step 2: Write RED per-entity timer independence test**

Edit Alice, advance 250 ms, edit Bob, advance 250 ms. Alice must dispatch at its own 500 ms deadline while Bob remains pending. This guarantees changing selection does not cancel Alice autosave.

- [ ] **Step 3: Write RED invalid/unchanged tests**

Assert invalid JSON, array/null properties, and whitespace-only name dispatch nothing. Valid JSON that differs only in whitespace/key order also dispatches nothing.

- [ ] **Step 4: Write RED Node/Edge command-shape tests**

For Node:

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

For Edge use `type: "update-edge"`, `edgeId`, current edge version, and the same normalized fields.

- [ ] **Step 5: Run RED controller tests**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts
```

Expected: FAIL because controller does not exist.

- [ ] **Step 6: Implement controller with one timer per entity key**

Subscribe to the Draft Store. Compare previous/current draft object references or `revision` to detect changed keys. For each changed draft, clear only that key's existing timer and schedule a new `setTimeout(..., delayMs ?? 500)`.

At timer execution time, re-read **latest** draft and **latest** Graph Zustand entity, call `evaluateInspectorDraft()`, and dispatch only when `status === "saveable" && dirty`.

Do not cache entity `version` when the timer is scheduled; resolve it at timer fire time so commands start with the latest local version. Existing Save Queue runtime remains responsible for refreshing version again immediately before durable PATCH.

- [ ] **Step 7: Cover lifecycle and disposal**

`start()` subscribes once. `dispose()` unsubscribes and clears all timers. Repeated `start()` must not duplicate subscriptions. Add a test that disposal prevents a scheduled dispatch.

- [ ] **Step 8: GREEN controller tests**

```bash
pnpm test -- src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts
```

Expected: PASS.

- [ ] **Step 9: Implement React lifecycle adapter**

Create the controller in a lifecycle-safe way without storing render-time persistence values in a React ref. Recreate only when Board/workspace/graphStore/draftStore/dispatch identity requires it, `start()` in effect setup and `dispose()` in cleanup. Add a small StrictMode hook test if the first implementation can be disposed during effect replay; copy the existing Save Queue `StrictMode` regression style rather than guessing.

- [ ] **Step 10: Commit**

```bash
git add src/frontend/features/graph-editor/inspector/inspector-autosave-controller* \
        src/frontend/features/graph-editor/inspector/use-inspector-autosave.ts
git commit -m "feat: add inspector autosave controller"
```

---

### Task 3: Convert Inspector to controlled drafts and wire page autosave

**Files:**
- Modify: `src/frontend/features/graph-editor/inspector/graph-inspector.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`

**Interfaces:**

Replace `GraphInspectorSaveInput` / `onSave` with controlled draft props:

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

`isLaneBusy` may continue to disable the explicit Remove action if preserving current behavior; it must never disable Name/Description/Properties typing.

- [ ] **Step 1: Convert existing Inspector component tests to RED autosave expectations**

Use fake timers. Remove clicks on `Save Node` / `Save Relationship` and assert those buttons no longer exist.

For Node:

```ts
await user.clear(screen.getByLabelText("Name"));
await user.type(screen.getByLabelText("Name"), "Alicia");
expect(mocks.updateNode).not.toHaveBeenCalled();
await vi.advanceTimersByTimeAsync(500);
await waitFor(() => expect(mocks.updateNode).toHaveBeenCalledTimes(1));
```

Do equivalent Relationship coverage.

- [ ] **Step 2: Add RED invalid Alice -> Bob -> Alice draft preservation test**

Sequence:

```text
select Alice
set Properties JSON to {"job":
assert validation message + updateNode 0
select Bob
select Alice
assert exact {"job": still visible
```

Use the canvas mock's Select buttons. This is the accepted UX and must be a direct component regression.

- [ ] **Step 3: Add RED response/version-remount regression**

Make `updateNode` return version 4 while the user types a newer value after the first save starts. Resolve the first request and assert the visible input remains the newest raw draft. This prevents reintroducing the current `key=...version` remount bug.

- [ ] **Step 4: Run RED page Inspector tests**

```bash
pnpm test -- src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
```

Expected: FAIL because current Inspector requires explicit Save and component-local state.

- [ ] **Step 5: Refactor `GraphInspector` to controlled inputs**

Remove component-local `useState`, submit handler, `<form onSubmit>`, and canonical Save button. Inputs become:

```tsx
<input
  value={draft.name}
  onChange={(event) => onDraftChange({ name: event.target.value })}
/>
```

Do the same for description and `propertiesText`. Render validation message immediately from `validationError`; render queue/409 `error` separately. Keep Version display sourced from `selection.entity.version` if useful, but version changes must not reset draft.

- [ ] **Step 6: Create one Board-scoped Draft Store in `GraphEditorContent`**

Use a stable store instance scoped to the current Board editor lifetime. Preferred pattern:

```ts
const [draftStore] = useState(createInspectorDraftStore);
const draftState = useInspectorDraftState(draftStore);
useInspectorAutosave({
  draftStore,
  graphStore: store,
  boardId,
  workspaceId,
  dispatch: saveQueue.dispatch,
});
```

If `GraphEditorPage` can remain mounted while `boardId` changes, key/reset the Draft Store at the Board boundary so drafts never leak across Boards. Do not put drafts in TanStack Query or Graph Zustand.

- [ ] **Step 7: Initialize/restore selected draft without overwrite**

When `inspectorSelection` exists, compute `node:<id>` / `edge:<id>`, call `ensureDraft()` only when missing, then render the stored draft. Remove `entity.version` from the Inspector React key; if a key remains, use only stable identity (`node:<id>` / `edge:<id>`).

- [ ] **Step 8: Remove `handleSaveInspector()` entirely**

Autosave controller now constructs `update-node` / `update-edge`. Page keeps selection, Board removal, Save Queue failure mapping, and graph rendering only.

- [ ] **Step 9: Compute selected validation from raw draft + current canonical entity**

Call `evaluateInspectorDraft()` for the selected entity and pass `message` when status is invalid. Validation must update immediately on typing, not after 500 ms.

- [ ] **Step 10: GREEN Inspector tests**

```bash
pnpm test -- src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
```

Expected: PASS for Node autosave, Edge autosave, invalid JSON, selection restore, response/version draft preservation, and 409 draft preservation.

- [ ] **Step 11: Commit**

```bash
git add src/frontend/features/graph-editor/inspector/graph-inspector.tsx \
        src/frontend/pages/graph-editor/graph-editor-page.tsx \
        src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx
git commit -m "feat: autosave inspector drafts"
```

---

### Task 4: Make global save state truthful and preserve failure/removal behavior

**Files:**
- Modify: `src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Verify/modify only if needed: `src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx`
- Verify/modify only if needed: `src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx`
- Verify/modify only if needed: `src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx`

**Interfaces:**

Add a pure save-state composer near Inspector draft model or save-state module:

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

Dirty summary must evaluate **all existing drafts**, not only the selected entity, against current Graph Zustand entities. This is required because Alice can hold invalid input while Bob is selected.

- [ ] **Step 1: Write RED save-indicator test for invalid unselected draft**

Sequence:

```text
initial -> Saved
select Alice -> type invalid JSON -> Unsaved
select Bob -> still Unsaved
no updateNode request
return Alice -> exact invalid draft remains
fix JSON -> debounce -> Unsaved/Saving… -> Saved after durable success
```

This test protects the design correction that Save Queue alone cannot truthfully represent invalid draft state.

- [ ] **Step 2: Write RED 409/failure typing test**

Make first autosave return 409. Assert:

```text
header Error + Retry
Inspector conflict message visible
current draft preserved
further typing still changes input
```

If further valid typing dispatches another same-lane operation, it must remain behind the failed operation per existing Save Queue rules. Do not redesign Retry ordering in this task.

- [ ] **Step 3: Implement all-draft dirty summary + combined state**

For each draft key, resolve the corresponding current Graph Zustand Node/Edge. Missing canonical entities should not be silently persisted; treat a surviving draft for an entity no longer present as dirty until the Board editor session ends, unless the entity was only detached from Board (canonical entity remains and can still be evaluated).

Render header from `combinedSaveState`, while Retry visibility/action still comes from actual Save Queue `error` state.

- [ ] **Step 4: Keep Board removal semantics explicit**

Run Board removal tests. Removal must still detach Board presentation only, preserve canonical entity data, clear selected Inspector when current behavior does so, and queue through the same entity lane. Do not automatically delete the draft merely because the entity is removed from the current Board; draft lifetime is the mounted editor session and canonical data still exists.

- [ ] **Step 5: GREEN focused regression tests**

```bash
pnpm test -- \
  src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/frontend/pages/graph-editor
git commit -m "feat: include inspector drafts in save state"
```

---

### Task 5: Update E2E, architecture instructions, and run full verification

**Files:**
- Modify: `tests/e2e/auth-story.spec.ts`
- Modify: `src/frontend/features/graph-editor/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md`
- Read/verify: `docs/superpowers/specs/2026-08-29-inspector-autosave-design.md`

- [ ] **Step 1: Update Graph Inspector E2E from click-Save to autosave response**

In `Graph Editor edits canonical Node and Relationship data through the Inspector`, remove Save button interactions. Before the final edit that should persist, install `page.waitForResponse()` for the canonical PATCH endpoint, edit the fields, then await the autosave response.

Node pattern:

```ts
const nodeUpdatePromise = page.waitForResponse((response) => {
  const path = new URL(response.url()).pathname;
  return response.request().method() === "PATCH" && path === `/api/v1/nodes/${aliceId}`;
});

await page.getByLabel("Name").fill("Alicia");
await page.getByLabel("Description").fill("Main protagonist");
await page.getByLabel("Properties JSON").fill('{"role":"lead","age":31}');

const nodeUpdate = await nodeUpdatePromise;
expect(nodeUpdate.status()).toBe(200);
await expect(page.getByText("Saved")).toBeVisible();
```

Repeat for Relationship PATCH. Reload and verify canonical values through UI/snapshot as the existing E2E already does.

- [ ] **Step 2: Add one E2E-visible invalid draft assertion without backend write**

Within the Inspector E2E or a focused new test, type incomplete JSON, assert `Properties must be valid JSON.` and `Unsaved`, then verify no canonical PATCH occurs during a window greater than 500 ms. Prefer request counting/routing if deterministic; do not add arbitrary long sleeps. Complete the JSON, await the PATCH, then assert `Saved`.

- [ ] **Step 3: Update Graph Editor AGENTS invariant**

Keep the file concise and add the draft boundary, for example:

```md
- Inspector의 raw/invalid 입력은 draft state가 소유하고 canonical Zustand에는 valid 값만 둔다.
```

Do not create a new AGENTS boundary just for `inspector/`.

- [ ] **Step 4: Synchronize architecture design**

Update state ownership/edit flow to record:

```text
Inspector typing
  → per-entity Inspector Draft Store
  → 500 ms debounce + validation
  → Command
  → valid Graph Zustand working state
  → Save Queue
  → HTTP/API/PostgreSQL
```

Also state that dirty/invalid draft contributes `Unsaved` to visible editor status and that invalid raw JSON never enters canonical Graph state.

- [ ] **Step 5: Run focused unit suite**

```bash
pnpm test -- \
  src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts \
  src/frontend/features/graph-editor/inspector/inspector-draft-store.test.ts \
  src/frontend/features/graph-editor/inspector/inspector-autosave-controller.test.ts \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-save-state.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run repository verification**

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

If `git diff --exit-code` is intended to check generated-file cleanliness, run it after all intended edits are committed/staged exactly as the repository CI does. Do not claim success from partial commands.

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

- [ ] **Step 7: Direct diff review against `main`**

Review specifically for:

```text
no backend/schema/migration changes
no Graph Zustand raw invalid JSON
no query-cache editor draft ownership
no explicit Inspector Save button
no input disabling while save pending
no entity.version React key reset
no debounce cancellation when selection changes
no save-state false Saved with dirty drafts
no automatic retry/conflict merge
Board detach remains presentation-only
same-Board hydration guard remains
```

Fix Critical/Important findings with regression tests before declaring the slice complete.

- [ ] **Step 8: Commit docs/E2E fixes**

```bash
git add tests/e2e/auth-story.spec.ts \
        src/frontend/features/graph-editor/AGENTS.md \
        docs/superpowers/specs/2026-08-28-story-graph-architecture-design.md
git commit -m "test: verify inspector autosave workflow"
```

- [ ] **Step 9: Open a Draft PR only after local/CI evidence is available**

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

- Spec coverage: explicit Save removal, 500 ms debounce, Node + Edge, invalid raw JSON isolation, Alice→Bob→Alice restoration, version-response no reset, typing during pending/failure, 409, Retry, truthful save indicator, Board removal, E2E reload verification are each assigned to a task.
- Dependency boundary: Draft Store does not import Save Queue/TanStack/React Flow; autosave controller uses Graph Store + Draft Store + command dispatch only; Graph Inspector remains UI-only.
- Timer boundary: timers are per entity, so selection changes do not cancel another entity's pending autosave.
- Save-state boundary: dirty is calculated across all drafts, not selected draft only.
- Type consistency: Node/Edge autosave emits the existing `UpdateNodeCommand` / `UpdateEdgeCommand` fields exactly.
- Scope: no backend/schema/contracts/general dependency scheduler/undo/realtime work.
- No placeholders: implementation decisions, test behaviors, command lines, and acceptance checks are explicit.
