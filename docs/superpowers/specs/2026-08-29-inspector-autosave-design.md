# Inspector Autosave Design

Status: Approved design awaiting implementation planning
Date: 2026-08-29

## 1. Context

The Graph Editor already has an Editor Save Queue that applies valid editor commands to Zustand immediately and persists them later through entity-local lanes. The Inspector still uses an explicit Save button and keeps `name`, `description`, and `propertiesText` as component-local state.

That model is insufficient for autosave because:

- component-local draft state is lost when selection changes,
- persisted version updates can remount the Inspector if its React key includes the entity version,
- `Properties JSON` needs to allow invalid intermediate text such as `{ "job":` while the user is typing,
- invalid intermediate JSON must never enter canonical Graph state or the Save Queue,
- persistence responses must not overwrite newer local typing.

This slice introduces a dedicated Inspector Draft layer above the existing Graph working state and Save Queue.

## 2. Goals

This slice will:

1. Replace explicit Inspector Save with debounced autosave for Node and Relationship canonical fields.
2. Preserve per-entity Inspector drafts when switching selections and restore them when returning.
3. Keep raw `Properties JSON` text separate from canonical `properties` objects so invalid intermediate JSON is safe.
4. Enqueue `update-node` / `update-edge` commands only when the current draft is saveable.
5. Reuse the existing Save Queue for ordering, error state, Retry, optimistic concurrency, and stale-response protection.
6. Keep typing responsive while persistence is pending or failing.
7. Preserve existing Board-vs-canonical ownership rules and frontend/backend boundaries.

## 3. Non-goals

This slice does not add:

- undo/redo,
- realtime collaboration or CRDT/Yjs,
- event sourcing,
- backend endpoints, schema changes, or migrations,
- Board presentation-field editing,
- general form framework adoption,
- background/offline persistence across a browser refresh,
- conflict merge UI beyond the existing 409 error message and Retry behavior.

Drafts are in-memory editor state for the current mounted Board editor session. Reloading the page restores the last durable server value, not an invalid unsaved draft.

## 4. State ownership

State ownership becomes:

- PostgreSQL: durable persisted truth.
- TanStack Query: fetched server state and mutation/cache lifecycle.
- Graph Zustand store: valid Graph Editor working state only.
- Inspector Draft Store: raw per-entity Inspector input, including invalid intermediate JSON.
- Save Queue: pending/running/failed durable operations and save metadata.
- React Flow: rendering/input only.

The Inspector Draft Store must not become a second canonical graph store. Its purpose is only to represent what the user is currently typing.

## 5. Draft identity and shape

Drafts are keyed by the same stable entity identity used by Save Queue lanes:

```text
node:<nodeId>
edge:<edgeId>
```

Each draft contains at least:

```ts
type InspectorDraft = {
  name: string;
  description: string;
  propertiesText: string;
};
```

The implementation may keep additional derived metadata such as validation state or a local revision, but raw input remains the source of truth for Inspector fields.

When an entity is selected for the first time, its draft is initialized from the current Graph Zustand entity:

```text
canonical entity
→ name
→ description
→ JSON.stringify(properties, null, 2)
→ Inspector Draft Store
```

If a draft already exists for that entity, selection must restore the existing draft instead of replacing it from a newer render or version update.

## 6. Selection behavior

Approved UX:

```text
select Alice
→ type invalid/incomplete JSON
→ select Bob
→ select Alice again
→ Alice's exact draft is restored
```

Changing selection never silently discards an existing draft.

A persisted version increment for the selected entity must also not reset the draft. Therefore the Inspector component must not rely on `entity.version` in a React key to manage draft lifecycle.

Draft replacement should happen only when the draft does not yet exist for that entity or when the editor intentionally clears/reinitializes it under an explicit rule added in a future slice.

## 7. Validation model

### Name

A draft is not saveable when `name.trim()` is empty.

The raw typed name may remain in the draft, including whitespace-only intermediate input. Canonical Graph state is not updated until the draft becomes saveable.

### Properties JSON

`propertiesText` is parsed only when evaluating whether autosave may run.

A saveable properties value must:

- parse successfully as JSON,
- be a non-null object,
- not be an array.

Examples:

```text
{ "age": 20, "job":
→ invalid intermediate draft
→ preserve exact text
→ show validation message
→ no command / no API call
```

```text
{ "age": 20, "job": "writer" }
→ valid draft
→ eligible for debounce/autosave
```

Invalid draft text must never be written into canonical Graph Zustand state.

## 8. Autosave timing

Autosave uses a 500 ms debounce after the latest Inspector draft edit.

```text
user edits draft
→ reset 500 ms timer
→ user remains idle for 500 ms
→ validate current draft
→ if valid and materially changed, dispatch update command
→ Save Queue
```

Rules:

- Every new keystroke before the timer fires resets the timer.
- Invalid drafts do not enqueue an operation.
- Returning to valid input starts a new debounce window.
- The implementation must not disable typing while a previous save is pending.
- No separate automatic retry loop is added; failed persistence continues to use the Save Queue's explicit Retry behavior.

## 9. Change detection and duplicate suppression

Autosave must not enqueue an update if the validated draft represents the same canonical values already present in the current Graph Zustand entity.

Compare normalized saveable values:

```text
trimmed name
description
parsed properties object
```

This avoids save loops caused by:

- selecting an entity,
- server version/timestamp reconciliation,
- rerenders,
- restoring a draft that already matches canonical working state.

The raw draft text itself does not need to be reformatted after save. For example, compact valid JSON may remain compact in the textarea even if canonical `properties` is an object.

## 10. Command and Save Queue integration

When a debounced draft is valid and materially changed, construct the same existing commands:

```text
update-node
update-edge
```

The command is dispatched through the existing `useEditorSaveQueue()` path.

Observable flow:

```text
Inspector typing
→ Inspector Draft Store immediately
→ 500 ms debounce
→ validate
→ update-node/update-edge Command
→ apply valid canonical values to Graph Zustand
→ Save Queue entity lane
→ EditorPersistence
→ API
→ PostgreSQL
```

This preserves the architecture rule that valid working graph state enters Zustand through commands rather than writing raw Inspector draft text directly into canonical entities.

## 11. Concurrent typing while persistence is running

Typing must remain independent from a running save.

Example:

```text
1. draft becomes "Alic"
2. debounce dispatches save for "Alic"
3. persistence starts
4. user continues typing "Alicia"
5. draft immediately shows "Alicia"
6. first response returns
7. response may update version/timestamp but must not reset draft to "Alic"
8. after debounce, "Alicia" is dispatched as the next same-node update
```

The existing Save Queue lane ordering and stale reconcile behavior remain responsible for durable ordering and preventing canonical snapback. The Draft Store remains authoritative for visible Inspector text.

## 12. Failure and 409 behavior

For persistence failure:

```text
save fails
→ Graph working state remains at the locally applied valid value
→ Inspector draft remains unchanged
→ Save Queue state becomes Error
→ existing Retry remains available
```

For optimistic locking `409`:

- preserve the current Inspector draft exactly,
- preserve the current valid local working state,
- show the existing entity-specific message:
  - `This Node changed elsewhere. Reload before saving again.`
  - `This Relationship changed elsewhere. Reload before saving again.`
- do not silently refetch/reset the draft,
- do not invent automatic conflict merge behavior in V1.

While a lane is failed, further user typing remains allowed and updates the draft. This slice does not redesign the Save Queue's failed-operation ordering semantics; Retry still retries the failed queued operation before later same-lane operations.

## 13. Inspector UI behavior

Remove the explicit canonical Save button from the Inspector.

Inspector keeps:

- Name field,
- Description field,
- Properties JSON field,
- validation/conflict message area,
- Remove from Board action.

The global Board header remains the durable save indicator:

```text
Saved
Unsaved
Saving…
Error · Retry
```

Inspector may show a local validation message such as:

```text
Properties must be valid JSON.
Properties must be a JSON object.
```

A local `Editing...` label is optional and not required for acceptance; the global Save Queue indicator is the authoritative persistence state.

`Remove from Board` remains a separate explicit action because it is destructive presentation membership removal, not a field edit.

## 14. Proposed source structure

```text
src/frontend/features/graph-editor/
├─ commands/
├─ inspector/
│  ├─ graph-inspector.tsx
│  ├─ inspector-draft-store.ts
│  ├─ inspector-draft-store.test.ts
│  └─ use-inspector-autosave.ts
├─ persistence/
├─ save-queue/
└─ store/
```

Exact file names may vary during implementation, but responsibilities must stay separated:

- Draft Store: raw per-entity draft lifecycle.
- Inspector component: render/edit draft and validation feedback.
- Autosave adapter/hook: debounce, validation, change detection, command construction.
- Save Queue: durable scheduling/failure/retry only.

The generic Graph store and Save Queue core must not import React component concerns.

## 15. Testing strategy

### Draft Store / autosave unit tests

Cover at least:

1. first selection initializes a draft from canonical entity values,
2. existing per-entity draft survives `Alice → Bob → Alice`,
3. persisted entity version changes do not reset an existing draft,
4. invalid JSON remains exactly preserved,
5. whitespace-only name is not saveable,
6. valid JSON object is saveable,
7. JSON arrays/null are rejected,
8. no materially changed canonical values means no dispatch,
9. edits inside 500 ms collapse to the latest autosave candidate,
10. invalid draft causes no command/API call,
11. returning from invalid to valid input schedules autosave.

### Graph Editor component tests

Cover at least:

1. Node field edits autosave after debounce without clicking Save,
2. Relationship field edits autosave after debounce,
3. rapid edits persist the latest value without blocking typing,
4. invalid `Properties JSON` shows validation and does not call the API,
5. invalid Alice draft survives selecting Bob and returning to Alice,
6. persistence response/version increment does not reset visible draft text,
7. 409 preserves the current draft and existing conflict message,
8. existing `Saved / Unsaved / Saving… / Error · Retry` behavior remains correct,
9. Remove from Board remains explicit and preserves canonical Story data.

### Full verification

Before integration run the repository's complete verification path:

- migrations,
- AGENTS validation,
- import-boundary validation,
- ESLint,
- TypeScript,
- unit tests,
- PostgreSQL integration tests,
- production build,
- tracked-file clean-tree check,
- Playwright Graph Editor flows.

E2E should preserve the existing `edit → saved → reload → verify` pattern and update Inspector edit flows to wait for autosave rather than clicking a Save button.

## 16. Architecture constraints

The slice must preserve:

- frontend ↔ backend only through HTTP `/api/v1`,
- frontend never imports backend/Drizzle/DB,
- PostgreSQL is durable truth,
- TanStack Query owns fetched server state,
- Graph Zustand owns valid editor working state,
- Inspector Draft Store owns only raw edit drafts,
- React Flow remains rendering/input only,
- Board remains View; canonical Node/Edge remain Story-owned,
- same-Board snapshot hydration guard remains,
- no source-target uniqueness constraint,
- no rollback of local working state solely because persistence fails,
- no speculative undo/realtime/CRDT/event-sourcing scope.

## 17. Acceptance criteria

This slice is complete when:

1. Inspector no longer requires a Save button for canonical field edits.
2. Node and Relationship edits autosave after 500 ms of inactivity.
3. Invalid intermediate JSON is preserved as raw draft and never enters canonical Graph state or persistence.
4. Per-entity drafts survive selection changes for the lifetime of the mounted Board editor.
5. Version updates and persistence responses do not reset visible drafts.
6. Save Queue remains the only durable editor write scheduler.
7. 409/network failures preserve draft + working state and surface existing Error/Retry behavior.
8. Existing Board removal and graph ownership invariants remain unchanged.
9. Full repository verification is green before integration.
