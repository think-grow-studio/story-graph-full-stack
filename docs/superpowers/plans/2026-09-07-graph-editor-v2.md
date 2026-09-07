# Graph Editor V2 Implementation Plan

> **For agentic workers:** execute this plan task-by-task with TDD. Do not merge to `main` until all verification is green and the user explicitly approves integration.

**Goal:** Replace the basic React Flow graph editor with a durable Graph Editor V2 that has clear directed/undirected semantics, four-direction magnetic connection ports, readable multi-edge bundles, focus mode for dense graphs, structured recursive properties, and long-term presentation/routing boundaries.

**Architecture:** Keep `Workspace → Story → Board → Node/Edge` ownership and the existing frontend ↔ contracts ↔ HTTP ↔ backend module boundary. Persist one semantic relationship per Edge. Keep bundles/focus as frontend projections. Persist Node/Edge presentation and Edge routing separately from semantic properties. Reset the unreleased Graph migration baseline instead of preserving old development Graph data.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 5.9.3, PostgreSQL 16, Drizzle ORM 0.45.2 / Drizzle Kit 0.31.10, Zod 4.4.3, Zustand 5.0.15, React Flow 12.11.5, TanStack Query 5.102.3, Vitest 4.1.10, React Testing Library 16.3.2, Playwright 1.62.1.

**Spec:** `docs/superpowers/specs/2026-09-07-graph-editor-v2-design.md`

## Global constraints

- Existing Graph development data may be deleted; Auth and Story data models remain.
- `Workspace → Story → Board → Node/Edge` remains the only Graph ownership hierarchy.
- One Edge represents one semantic relationship statement.
- Edge direction is `DIRECTED | UNDIRECTED`; do not add `BIDIRECTIONAL`.
- Opposite meanings between the same two Nodes are two independent Edges.
- Multiple parallel Edges between the same unordered Node pair are valid.
- Relationship bundles are computed frontend projections and are never persisted.
- All user-defined scalar property leaves are strings; nested objects/arrays are supported.
- Semantic properties, presentation, and routing remain separate.
- Preserve row CAS (`expectedVersion`), Save Queue lanes, autosave, optimistic working state, and Undo/Redo.
- Drag connection must have a non-drag alternative.
- Default Edge routing for newly created Edges is copied from `board.graphSettings.defaultEdgeRouting`; changing Board defaults does not silently rewrite existing Edges.
- `sourcePort` and `targetPort` may persist as `auto`; the resolved physical side is a rendering concern.
- Node/Edge focus, dimming, bundle expansion, port hover state, and target-pick mode are transient UI state and must not enter the persisted graph store.

---

## Task 1: Make the V2 contracts and domain model authoritative

**Files**

- Modify: `src/contracts/graph/graph.contract.ts`
- Modify: `src/contracts/graph/graph.contract.test.ts`
- Modify: `src/backend/modules/graph/domain/graph.ts`
- Modify: `src/backend/modules/graph/domain/graph.repository.ts`
- Modify: `src/backend/AGENTS.md`
- Modify: `src/frontend/features/graph-editor/AGENTS.md`

### Interfaces produced

```ts
type GraphPropertyValue =
  | string
  | GraphPropertyValue[]
  | { [key: string]: GraphPropertyValue };

type GraphProperties = Record<string, GraphPropertyValue>;

type GraphSettings = {
  defaultEdgeRouting: "orthogonal" | "straight" | "curved";
  snapToGrid: boolean;
  layoutMode: "free";
};

type NodePresentation = {
  shape: "rounded-rect" | "rect" | "ellipse" | "diamond";
  fillColor: string | null;
  borderColor: string | null;
  borderWidth: number | null;
  textColor: string | null;
};

type EdgeDirection = "DIRECTED" | "UNDIRECTED";

type EdgePresentation = {
  strokeColor: string | null;
  strokeWidth: number | null;
  strokeStyle: "solid" | "dashed" | "dotted";
  labelColor: string | null;
};

type EdgeRouting = {
  type: "orthogonal" | "straight" | "curved";
  sourcePort: "auto" | "top" | "right" | "bottom" | "left";
  targetPort: "auto" | "top" | "right" | "bottom" | "left";
  waypoints: Array<{ x: number; y: number }>;
};
```

### Steps

- [ ] Add RED contract tests that reject numeric/boolean/null property leaves, accept nested string objects/arrays, reject nesting deeper than 6, reject more than 200 entries, and enforce key/value length limits.
- [ ] Add RED contract tests for Board `graphSettings`, Node `kind/presentation`, Edge `direction/kind/presentation/routing`, and removal of legacy `style/labelPresentation` fields.
- [ ] Run:

```bash
pnpm vitest run src/contracts/graph/graph.contract.test.ts
```

Expected: new V2 tests fail because current schemas still accept arbitrary JSON and expose legacy style fields.

- [ ] Implement a recursive Zod property schema plus a root-level traversal refinement for depth/count/key/value limits.
- [ ] Add typed presentation/routing/direction schemas with strict objects and safe numeric bounds (`borderWidth >= 0`, `strokeWidth > 0`, finite waypoint coordinates).
- [ ] Update request/response/restore schemas so Node and Edge use the new fields everywhere.
- [ ] Update backend domain types and repository signatures to use explicit `GraphProperties`, `NodePresentation`, `EdgePresentation`, `EdgeRouting`, `EdgeDirection`, and `GraphSettings` instead of `JsonObject` for Graph-owned fields.
- [ ] Update AGENTS guidance: properties have string leaves; semantic/presentation/routing are separate; bundles/focus are frontend projections.
- [ ] Re-run the focused contract tests and then domain/application TypeScript tests affected by compile errors.

Expected GREEN: the contract suite passes and no legacy `style` or `labelPresentation` remains in Graph contract/domain types.

**Commit:** `refactor(graph): define Graph Editor V2 contracts`

---

## Task 2: Reset the Graph database baseline to V2

**Files**

- Modify: `src/backend/infrastructure/database/schema/graph.schema.ts`
- Modify: `src/backend/infrastructure/database/schema/board-tag.schema.ts`
- Replace: `drizzle/0002_board_owned_graph.sql` → generated `drizzle/0002_graph_editor_v2.sql`
- Replace: `drizzle/meta/0002_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Modify: `tests/integration/graph/graph-repository.integration.ts`

### Persisted changes

- `board.graph_settings jsonb NOT NULL`
- `graph_node.kind text NOT NULL DEFAULT 'entity'`
- replace `graph_node.style` with `graph_node.presentation`
- `graph_edge.direction text NOT NULL` with DB check `DIRECTED|UNDIRECTED`
- `graph_edge.kind text NOT NULL DEFAULT 'relationship'`
- replace `style` + `label_presentation` with `presentation` + `routing`
- `board_tag`: remove secondary `board_id` index and add `name` index
- keep same-Board composite endpoint FKs and row version columns

### Steps

- [ ] Add/modify RED repository integration expectations for all new columns, two opposite directed Edges between the same Nodes, an undirected Edge, parallel Edges, same-Board FK rejection, CAS, delete/restore identity, and Board graph settings.
- [ ] Update Drizzle schemas.
- [ ] Reset only Graph migration metadata: remove the old generated Graph `0002` SQL/snapshot, restore journal state to `0000 + 0001`, then run:

```bash
DATABASE_URL=<fresh-test-db> pnpm db:generate
```

- [ ] Rename/verify generated tag as `0002_graph_editor_v2` if Drizzle produces a random migration name; migration contents and snapshot must remain generated-consistent.
- [ ] Run on a fresh PostgreSQL database:

```bash
pnpm db:migrate
pnpm db:check
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph/graph-repository.integration.ts
```

Expected GREEN: a fresh DB builds `0000 → 0001 → 0002_graph_editor_v2`, Graph repository tests pass, and migration metadata matches schema.

- [ ] Document in the plan/PR that any local DB with old Graph `0002` must be reset; do not write compatibility SQL.

**Commit:** `refactor(db): reset Graph Editor V2 baseline`

---

## Task 3: Carry V2 semantics through backend use-cases, routes, API docs, and frontend API

**Files**

- Modify: `src/backend/modules/graph/application/create-board/create-board.ts`
- Modify: `src/backend/modules/graph/application/update-board/update-board.ts`
- Modify: `src/backend/modules/graph/application/create-node/create-node.ts`
- Modify: `src/backend/modules/graph/application/update-node/update-node.ts`
- Modify: `src/backend/modules/graph/application/create-edge/create-edge.ts`
- Modify: `src/backend/modules/graph/application/update-edge/update-edge.ts`
- Modify restore-related Graph application code/tests as required by new entity shapes
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Modify: `src/app/api/v1/_shared/graph-http.ts`
- Modify Board/Node/Edge route handlers under `src/app/api/v1/boards/[boardId]/**`
- Modify: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify: `src/backend/infrastructure/openapi/openapi-document.test.ts`
- Modify: `src/frontend/api/graph/graph.api.ts`
- Modify: `src/frontend/api/graph/graph.queries.ts` only where input types require it
- Modify: `src/backend/modules/graph/application/{board,node,edge}.use-cases.test.ts`
- Modify: `tests/integration/graph/graph-api.integration.ts`

### Steps

- [ ] Add RED use-case/API tests proving:
  - Node create/update round-trips `kind`, recursive properties, and presentation.
  - Edge create/update round-trips direction, kind, presentation, and routing.
  - two opposite directed relationships remain separate rows.
  - invalid recursive properties are rejected at the HTTP contract boundary.
  - stale semantic/presentation/routing update returns 409.
- [ ] Run focused RED tests.
- [ ] Update use-case input signatures and repository mapping while preserving access checks and same-Board endpoint validation.
- [ ] Treat Board default routing as a creation default: when the frontend creates an Edge it sends a concrete routing type derived from the current Board settings; existing Edge routing is never mutated merely because Board settings change.
- [ ] Update route body mapping and HTTP response adapters.
- [ ] Update OpenAPI schemas/examples to describe direction, recursive properties, presentation, and routing.
- [ ] Update frontend API inputs to the exact new contract fields; remove all `style` and `labelPresentation` API options.
- [ ] Run:

```bash
pnpm vitest run \
  src/backend/modules/graph/application/board.use-cases.test.ts \
  src/backend/modules/graph/application/node.use-cases.test.ts \
  src/backend/modules/graph/application/edge.use-cases.test.ts \
  src/backend/infrastructure/openapi/openapi-document.test.ts
pnpm vitest run --config vitest.integration.config.ts tests/integration/graph
```

Expected GREEN: backend + HTTP + integration agree on the new model.

**Commit:** `refactor(graph): propagate V2 model through API`

---

## Task 4: Upgrade editor commands, optimistic runtime, persistence, and history without breaking CAS

**Files**

- Modify: `src/frontend/features/graph-editor/commands/node-commands.ts`
- Modify: `src/frontend/features/graph-editor/commands/edge-commands.ts`
- Modify: `src/frontend/features/graph-editor/commands/editor-command-runtime.ts`
- Modify corresponding command runtime tests
- Modify: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Modify: `src/frontend/features/graph-editor/history/editor-history-entry.ts`
- Modify history tests
- Modify store fixtures/tests as required

### Command shape

`UpdateNodeCommand` must carry the complete Inspector-editable semantic/presentation state needed for deterministic optimistic update + inverse creation. `UpdateEdgeCommand` must do the same for direction/kind/presentation/routing. Create commands carry concrete V2 defaults so optimistic rows match persisted rows.

### Steps

- [ ] Add RED tests showing optimistic create contains V2 defaults and optimistic update applies all V2 fields.
- [ ] Add RED history tests proving Node/Edge property, direction, presentation, and routing updates restore the exact prior values on Undo.
- [ ] Preserve the already-fixed invariant that a late create/update response cannot resurrect an optimistically deleted Node/Edge.
- [ ] Update persistence adapters to send all V2 fields.
- [ ] Update merge/reconciliation helpers so persisted version/timestamps reconcile while newer local semantic/presentation/routing state remains intact.
- [ ] Run:

```bash
pnpm vitest run src/frontend/features/graph-editor/commands src/frontend/features/graph-editor/history src/frontend/features/graph-editor/persistence src/frontend/features/graph-editor/store
```

Expected GREEN: CAS/queue/history behavior stays intact with the richer rows.

**Commit:** `refactor(editor): support V2 graph commands and history`

---

## Task 5: Build pure graph projection modules for bundles, ports, routing, and focus

**Files**

- Create: `src/frontend/features/graph-editor/model/relationship-bundle.ts`
- Create: `src/frontend/features/graph-editor/model/relationship-bundle.test.ts`
- Create: `src/frontend/features/graph-editor/model/port-resolver.ts`
- Create: `src/frontend/features/graph-editor/model/port-resolver.test.ts`
- Create: `src/frontend/features/graph-editor/model/focus-projection.ts`
- Create: `src/frontend/features/graph-editor/model/focus-projection.test.ts`
- Create: `src/frontend/features/graph-editor/model/edge-route-projection.ts`
- Create: `src/frontend/features/graph-editor/model/edge-route-projection.test.ts`

### Pure interfaces

```ts
type RelationshipBundle = {
  key: string;
  nodeIds: readonly [string, string];
  edges: GraphEdgeResponse[];
};

type ResolvedPort = "top" | "right" | "bottom" | "left";

type FocusProjection = {
  focusedNodeIds: Set<string>;
  focusedEdgeIds: Set<string>;
  secondaryEdgeIds: Set<string>;
};
```

### Steps

- [ ] RED bundle tests: unordered pair grouping; deterministic order `UNDIRECTED → lowerId→higherId → higherId→lowerId → edgeId`; stable lane index across reload order changes.
- [ ] RED port tests: left/right/top/bottom chosen from relative Node centers; explicit persisted port overrides `auto`; ties resolve deterministically.
- [ ] RED focus tests:
  - selected Node focuses itself + incident Edges + direct neighbor Nodes;
  - selected Edge focuses itself + endpoints and marks same-bundle siblings secondary;
  - no selection leaves all normal.
- [ ] RED route projection tests: map `straight|orthogonal|curved`, resolved ports, bundle lane index, and direction into a renderer descriptor without mutating persisted Edge rows.
- [ ] Implement pure functions only; no React/DOM imports.
- [ ] Run focused tests.

Expected GREEN: dense-graph readability behavior is deterministic and independently testable before UI rendering.

**Commit:** `feat(editor): add graph bundle and focus projections`

---

## Task 6: Replace default React Flow Nodes with four-direction Magnetic Ports

**Files**

- Create: `src/frontend/widgets/graph-editor/story-graph-node.tsx`
- Create: `src/frontend/widgets/graph-editor/story-graph-node.test.tsx`
- Modify: `src/frontend/widgets/graph-editor/graph-canvas.tsx`
- Modify: `src/frontend/widgets/graph-editor/graph-canvas.test.tsx`
- Modify: `src/app/globals.css`
- Later reconcile durable token additions into `DESIGN.md` in Task 10

### UX contract

- Four physical ports: top/right/bottom/left.
- React Flow `connectionMode=Loose` so any port can initiate/receive.
- Visible port dot is subtle; pointer hit target is ~24px.
- Ports become visually clear on Node hover, selection, keyboard focus, or active connection creation.
- Connection target state uses Graph Indigo tint; enabled pointers use deliberate hover/cursor/focus state.
- Drag is not the only relationship-creation path (Task 8 provides target-pick mode).

### Steps

- [ ] Add RED component tests asserting four Handles with stable IDs and correct positions.
- [ ] Add RED Canvas tests asserting custom node type registration and loose connection mode.
- [ ] Add RED test that connection callback carries source/target Node IDs regardless of which physical handles were used.
- [ ] Implement custom Node while preserving Node drag and click selection.
- [ ] Use large invisible/low-opacity hit areas with small visible dots so precise targeting is not required.
- [ ] Add `onConnectStart/onConnectEnd` transient state so eligible targets/ports can be emphasized during connection creation.
- [ ] If node-body drop can be implemented through React Flow’s connection-end APIs without private internals, resolve it to the nearest port; otherwise keep 24px four-side hit targets as the supported V2 interaction and do not add brittle DOM hit-testing.
- [ ] Run widget tests.

Expected GREEN: all four sides can start/receive a connection and existing drag/move behavior still passes.

**Commit:** `fix(editor): add four-direction magnetic connection ports`

---

## Task 7: Render readable bundled relationships and Focus Mode

**Files**

- Create: `src/frontend/widgets/graph-editor/story-graph-edge.tsx`
- Create: `src/frontend/widgets/graph-editor/story-graph-edge.test.tsx`
- Modify: `src/frontend/widgets/graph-editor/graph-canvas.tsx`
- Modify: `src/frontend/widgets/graph-editor/graph-canvas.test.tsx`
- Modify model projection files from Task 5 if rendering reveals missing pure data

### Rendering contract

- default newly-created routing: `orthogonal` copied from Board default;
- `straight`, `orthogonal`, and `curved` are supported;
- `DIRECTED` renders a semantic target arrow; `UNDIRECTED` does not;
- parallel/bidirectional Edges receive deterministic lane offsets instead of exact overlap;
- idle bundles stay compact; hovered/selected bundles expand enough to distinguish labels and directions;
- Node focus dims unrelated Nodes/Edges to roughly 20% visual emphasis;
- selected Edge strongly emphasizes endpoints and selected path; same-bundle siblings get secondary emphasis.

### Steps

- [ ] Add RED edge component tests for routing type, semantic marker, label, lane offset, selected/secondary/dim states.
- [ ] Add RED Canvas projection test for A→B + B→A rendering as two distinct Edge render entries with stable lanes.
- [ ] Implement custom Edge using React Flow edge geometry helpers where sufficient; keep lane offset calculation owned by Story Graph projection code.
- [ ] Wire Node/Edge selection into focus projection and pass visual states down; focus state stays transient.
- [ ] Ensure focus is not color-only: use opacity/stroke width/outline changes as well as Indigo.
- [ ] Run widget + model tests.

**Commit:** `feat(editor): add relationship bundles and focus mode`

---

## Task 8: Redesign relationship creation for drag and target-pick flows

**Files**

- Modify: `src/frontend/features/graph-editor/actions/relationship-dialog.tsx`
- Modify: `src/frontend/features/graph-editor/actions/relationship-dialog.test.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.test.tsx`
- Add focused page/interaction test if the existing page test becomes too broad

### Dialog result

```ts
type RelationshipDraftResult = {
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  direction: "DIRECTED" | "UNDIRECTED";
};
```

### Steps

- [ ] Add RED dialog tests for `방향 있음/방향 없음`, visual A→B/A—B preview, and `방향 바꾸기` swapping endpoints before creation.
- [ ] Add RED page test for drag connection opening the dialog without persisting until submit.
- [ ] Add RED page test for non-drag flow:
  `select Node → 관계 만들기 → click target Node → dialog → create`.
- [ ] Ensure Escape/Cancel exits pending connection/target-pick mode without creating an Edge.
- [ ] Create Edge with concrete default presentation/routing from current Board graph settings.
- [ ] Prevent self-edge in V2 UI unless the existing product explicitly needs it; contract may still reject or allow according to the finalized test. For this implementation choose **reject self-edge** because current requested UX concerns relationships between Nodes and self-loop routing is not designed yet.
- [ ] Preserve source/target semantics when ports are physically loose: drag origin determines default semantic source, not port side.
- [ ] Run actions + page tests.

**Commit:** `feat(editor): improve relationship creation workflow`

---

## Task 9: Replace raw JSON properties with structured recursive key-value editing

**Files**

- Create: `src/frontend/features/graph-editor/inspector/properties/property-editor.tsx`
- Create: `src/frontend/features/graph-editor/inspector/properties/property-editor.test.tsx`
- Create: `src/frontend/features/graph-editor/inspector/properties/property-model.ts`
- Create: `src/frontend/features/graph-editor/inspector/properties/property-model.test.ts`
- Modify: `src/frontend/features/graph-editor/inspector/inspector-draft-model.ts`
- Modify: `src/frontend/features/graph-editor/inspector/inspector-draft-model.test.ts`
- Modify: `src/frontend/features/graph-editor/inspector/graph-inspector.tsx`
- Modify Inspector autosave/store tests where draft shape changes

### UI behavior

Simple object example renders as rows:

```text
직업      [마법사]
수입      [월 200만원]
사는 곳   [객체 ▾]
  나라    [A 나라]
  도시    [B 도시]
+ 속성 추가
```

Arrays have explicit add/remove value controls. Nested object/array controls do not depend on drag. The UI never asks ordinary users to type JSON.

### Steps

- [ ] RED model tests for immutable add/update/remove object keys, nested object values, arrays, depth/count constraints, and duplicate/blank key validation.
- [ ] RED component tests for adding a key/value, changing values, creating nested object/list, removing rows, keyboard operability, and validation text.
- [ ] Replace `propertiesText` in Inspector draft with structured `GraphProperties` plus validation metadata.
- [ ] Ensure invalid structured properties never dispatch an update command.
- [ ] Keep autosave semantics: valid edits debounce into the entity’s existing `node:<id>` / `edge:<id>` lane.
- [ ] Ensure property update is one entity update history entry so Undo restores the exact prior property tree.
- [ ] Add `kind` field to Inspector. Expose minimal Edge routing selector (`직각 / 직선 / 곡선`) and direction selector because they are core V2 semantics. Persist presentation fields but do not ship the full visual styling studio yet.
- [ ] Run Inspector tests.

**Commit:** `feat(editor): add structured graph property editor`

---

## Task 10: Integrate the Graph Editor V2 screen and durable design language

**Files**

- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Modify all existing `src/frontend/pages/graph-editor/*.test.tsx` fixtures to V2 entity shape
- Modify: `DESIGN.md`
- Modify: `src/app/globals.css`
- Modify: `src/frontend/widgets/graph-editor/graph-canvas.tsx`
- Modify: `src/frontend/features/graph-editor/inspector/graph-inspector.tsx`

### Layout/design rules

- Canvas stays dominant; Inspector stays secondary.
- Magnetic Ports and graph focus are the signature interaction, not decorative gradients/chrome.
- Reuse current Surface/Ink/Line/Graph Indigo tokens.
- Add only durable tokens actually needed for graph target tint/dim/focus if current tokens cannot express them cleanly.
- Selected and connected graph state must remain understandable without relying on color alone.
- Every drag action has a click/keyboard alternative.
- At narrow widths Inspector remains reachable below/through responsive stacking; controls cannot require hover.

### Steps

- [ ] Reduce page responsibility: page owns async/editor orchestration and transient selection/connection mode; bundle/port/route/focus math stays outside it.
- [ ] Update all page fixtures to V2 contracts.
- [ ] Update `DESIGN.md` Graph Editor section with approved Magnetic Ports, focus behavior, orthogonal default, and semantic-vs-presentation distinction.
- [ ] Add runtime CSS tokens/classes once, not screen-local duplicated hex values.
- [ ] Run all frontend graph-editor tests:

```bash
pnpm vitest run \
  src/frontend/features/graph-editor \
  src/frontend/widgets/graph-editor \
  src/frontend/pages/graph-editor
```

Expected GREEN with no raw `속성 JSON` field and no default React Flow Node/Bezier dependency.

**Commit:** `feat(editor): integrate Graph Editor V2 experience`

---

## Task 11: Update E2E coverage and run release-grade verification

**Files**

- Modify: `tests/e2e/helpers/graph-fixtures.ts`
- Modify: `tests/e2e/auth-story.spec.ts` as required by V2 request/response shape
- Modify: `tests/e2e/board-independence.spec.ts`
- Modify: `tests/e2e/editor-history.spec.ts`
- Modify: `tests/e2e/node-delete-history.spec.ts`
- Modify: `tests/e2e/relationship-delete-history.spec.ts`
- Modify: `tests/e2e/product-ui-authoring.spec.ts`
- Create: `tests/e2e/graph-editor-v2.spec.ts`

### V2 browser acceptance flow

- [ ] Create Story + Board.
- [ ] Create Nodes A and B.
- [ ] Verify custom ports are reachable and drag A→B opens Relationship dialog.
- [ ] Create `A → B : 친구라고 생각함`.
- [ ] Create `B → A : 친구라고 속임`.
- [ ] Verify both labels/directions are distinguishable and neither overwrites the other.
- [ ] Add another parallel Edge and verify bundle produces separate render lanes.
- [ ] Select A and verify connected subgraph is emphasized while unrelated Node C is dimmed.
- [ ] Select one Edge and verify endpoints + same bundle context are emphasized.
- [ ] Create/update nested properties through key-value UI; reload and verify persistence.
- [ ] Change routing `orthogonal → straight → curved`; reload and verify persisted selection.
- [ ] Verify non-drag `관계 만들기` target-pick path.
- [ ] Verify Node delete removes incident Edges; Undo restores all V2 fields and same IDs.
- [ ] Verify Edge delete/Undo restores direction/presentation/routing/properties.
- [ ] Verify Board B remains independent.

### Full verification

Run from a fresh Graph database:

```bash
pnpm db:check
pnpm check
pnpm test:integration
pnpm build
pnpm e2e
```

Also verify:

```bash
rg 'style|labelPresentation|propertiesText|ConnectionMode.Strict|defaultEdgeOptions.*bezier' \
  src/contracts/graph \
  src/backend/modules/graph \
  src/frontend/features/graph-editor \
  src/frontend/widgets/graph-editor \
  src/frontend/pages/graph-editor
```

Interpret matches rather than blindly deleting unrelated words; Graph V2 production data fields must not retain legacy `style`, `labelPresentation`, or raw `propertiesText` concepts.

- [ ] Run Frontend Design Premium verification/audit if the installed plugin exposes its audit script in this environment; otherwise perform the equivalent static checks manually and report the tooling limitation explicitly.
- [ ] Verify keyboard/focus behavior, reduced motion, narrow viewport, success/error/save states, connection cancel, and dense-graph focus state in a real browser or Playwright.
- [ ] Request code review and inspect the complete PR diff before completion.
- [ ] Do not merge until the user chooses integration.

**Commit:** `test(editor): verify Graph Editor V2 workflows`

---

## Final acceptance checklist

- [ ] Fresh DB migration sequence is `0000_auth-foundation → 0001_story-foundation → 0002_graph_editor_v2`.
- [ ] No compatibility migration for old Graph dev data.
- [ ] Board default routing is persisted and applied to newly-created Edges.
- [ ] Node/Edge `kind` is free-form string.
- [ ] Property scalar leaves are strings and nested object/array data is supported.
- [ ] Node presentation and Edge presentation/routing are typed persisted objects.
- [ ] Edge direction is only `DIRECTED | UNDIRECTED`.
- [ ] Opposite meanings are independent Edges.
- [ ] Multiple Edges per pair render readably through deterministic bundles/lanes.
- [ ] Four-direction loose Magnetic Ports work from both sides.
- [ ] Relationship creation works by drag and target-pick.
- [ ] Orthogonal is the default; straight/curved can be selected.
- [ ] Node selection focuses neighbors/incident Edges and dims unrelated graph.
- [ ] Edge selection focuses endpoints and preserves sibling-bundle context.
- [ ] Raw JSON property textarea is gone.
- [ ] Undo/Redo, autosave, Save Queue serialization, late-response non-resurrection, CAS 409, delete/restore identity, and reload persistence remain green.
- [ ] Full `pnpm check`, integration, build, and E2E are green before completion.
