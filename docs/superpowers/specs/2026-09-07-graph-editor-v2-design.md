# Graph Editor V2 Design

**Date:** 2026-09-07  
**Status:** Proposed for implementation  
**Branch:** `feat/graph-editor-v2`

## 1. Goal

Evolve Story Graph from a basic Board-owned graph canvas into a durable graph-authoring system that remains usable when Nodes and relationships become dense, while preserving the product's flexibility across story writing, counseling/genogram-style mapping, mystery/investigation boards, board games, and other user-defined graph domains.

The V2 design fixes the current connection ergonomics and establishes long-lived boundaries for semantic data, presentation, routing, relationship bundling, properties, focus/navigation, and later layout/style tooling.

This is a pre-release reset. Existing Graph development data does not need to be preserved. Auth and Story foundations remain; the Graph baseline may be regenerated and development databases reset.

## 2. Product context and non-goals

### Current product model

- `Workspace → Story → Board → Node/Edge` remains the ownership hierarchy.
- A Story is the whole authored project/world, not a chapter.
- A Board is an independent graph canvas inside a Story.
- Nodes and Edges belong to exactly one Board and are never shared between Boards.
- The same conceptual character/entity on two Boards is intentionally duplicated.

### Future product direction

The product will later add story/document authoring. A user will write story text, choose one or more graphs/Boards, and an AI system will compare the text against graph semantics to surface possible setting inconsistencies.

That AI/document workflow is **not part of this V2 MVP**. V2 must, however, keep graph semantics clean enough that a later AI layer can consume Node/Edge data without interpreting visual presentation or routing.

### Explicit non-goals for this V2 implementation

- Full story/document editor.
- AI consistency analysis.
- Production-grade automatic graph layout engine such as hierarchical/radial/force layout.
- Full Node/Edge visual styling studio.
- Palette drag-to-create Node workflow.
- Cross-Board shared/canonical entities.

V2 creates extension boundaries for these features without implementing them prematurely.

## 3. Design principles

1. **One Node = one entity.**
2. **One Edge = one relationship meaning.**
3. **Semantic meaning is independent from visual presentation.**
4. **Routing is independent from visual style.**
5. **Multiple Edges between the same two Nodes are valid and first-class.**
6. **Bundles are a rendering concern, never a persisted domain entity.**
7. **Graph complexity must be navigable through focus, dimming, bundling, and later layout assistance.**
8. **Drag is fast, but never the only way to perform an action.**
9. **User properties remain schema-flexible; every scalar leaf is stored as a string.**
10. **The graph model must serve writing, counseling/genograms, investigation boards, and other user-defined domains without hard-coded domain enums.**

## 4. Data model

### 4.1 Board

Board remains the graph ownership boundary.

Proposed persisted shape:

```ts
type GraphSettings = {
  defaultEdgeRouting: "orthogonal" | "straight" | "curved";
  snapToGrid: boolean;
  layoutMode: "free";
};

type Board = {
  id: string;
  storyId: string;
  name: string;
  description: string;
  graphSettings: GraphSettings;
  createdAt: string;
  updatedAt: string;
};
```

V2 default:

```ts
{
  defaultEdgeRouting: "orthogonal",
  snapToGrid: false,
  layoutMode: "free"
}
```

`layoutMode` intentionally supports only `free` now. Future automatic layout modes may be added without changing Node/Edge ownership.

### 4.2 Node

```ts
type NodePresentation = {
  shape: "rounded-rect" | "rect" | "ellipse" | "diamond";
  fillColor: string | null;
  borderColor: string | null;
  borderWidth: number | null;
  textColor: string | null;
};

type GraphNode = {
  id: string;
  boardId: string;

  name: string;
  description: string;
  kind: string;
  iconKey: string | null;
  properties: GraphProperties;

  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number;

  presentation: NodePresentation;

  version: number;
  createdAt: string;
  updatedAt: string;
};
```

`kind` is a free-form string, not a database enum. The UI may provide common presets such as `entity`, `person`, `event`, `place`, `organization`, or `evidence`, but custom values remain valid.

V2 UI may expose only a subset of presentation controls. The persisted shape exists now so later shape/fill/border/text styling does not require another semantic model rewrite.

### 4.3 Properties

Properties remain JSONB because the product must support user-defined nested data.

Every scalar leaf is a string:

```ts
type PropertyValue =
  | string
  | PropertyValue[]
  | { [key: string]: PropertyValue };

type GraphProperties = {
  [key: string]: PropertyValue;
};
```

Examples:

```json
{
  "직업": "마법사",
  "수입": "월 200만원",
  "사는 곳": {
    "나라": "A 나라",
    "도시": "B 도시"
  },
  "별명": [
    "붉은 마법사",
    "북부의 현자"
  ]
}
```

Even numeric-looking values remain strings (`"37"`, `"183cm"`, `"2025"`). Story Graph does not infer domain type semantics from user content.

Application-level validation:

- root must be an object;
- object keys are non-empty after trim;
- scalar leaves must be strings;
- arrays may contain strings, objects, or arrays recursively;
- maximum nesting depth: 6;
- maximum total property entries per entity: 200;
- maximum key length: 100 characters;
- maximum scalar value length: 10,000 characters.

These limits protect UI/runtime behavior without hard-coding domain types.

### 4.4 Edge

An Edge is one semantic relationship statement.

```ts
type EdgeDirection = "DIRECTED" | "UNDIRECTED";

type EdgePresentation = {
  strokeColor: string | null;
  strokeWidth: number | null;
  strokeStyle: "solid" | "dashed" | "dotted";
  labelColor: string | null;
};

type PortPreference = "auto" | "top" | "right" | "bottom" | "left";

type EdgeRouting = {
  type: "orthogonal" | "straight" | "curved";
  sourcePort: PortPreference;
  targetPort: PortPreference;
  waypoints: Array<{ x: number; y: number }>;
};

type GraphEdge = {
  id: string;
  boardId: string;

  sourceNodeId: string;
  targetNodeId: string;

  direction: EdgeDirection;
  name: string;
  description: string;
  kind: string;
  iconKey: string | null;
  properties: GraphProperties;

  presentation: EdgePresentation;
  routing: EdgeRouting;

  version: number;
  createdAt: string;
  updatedAt: string;
};
```

`kind` is also free-form and defaults to `relationship`.

### 4.5 Relationship direction semantics

V2 supports only two semantic direction modes:

- `DIRECTED`: source has the stated relationship toward target.
- `UNDIRECTED`: the relationship is symmetric for this statement.

There is intentionally **no `BIDIRECTIONAL` mode**.

Example with different meanings in each direction:

```text
A ──친구라고 생각함──▶ B
B ──친구라고 속임────▶ A
```

This is persisted as two independent directed Edges.

Example with one symmetric meaning:

```text
A ───── 형제 ───── B
```

This is one undirected Edge.

This rule avoids `forward*` / `backward*` duplicated fields and gives future AI analysis one clear semantic statement per Edge.

### 4.6 Visual markers are not semantic direction

Arrowheads are derived from `direction` by default:

- directed → arrow at target;
- undirected → no semantic arrow.

Future presentation controls may customize decorative markers, but marker appearance must never change the persisted `direction` semantic meaning.

## 5. Database baseline

Because the product is pre-release and Graph development data may be deleted, regenerate the Graph baseline rather than writing a compatibility migration.

Migration history remains conceptually:

```text
0000_auth-foundation
0001_story-foundation
0002_graph-editor-v2
```

Existing databases that have the old Graph `0002` applied must be reset before using the new baseline.

### Proposed Graph tables

#### `board`

- `id text PK`
- `story_id text FK story(id) ON DELETE CASCADE`
- `name text NOT NULL`
- `description text NOT NULL DEFAULT ''`
- `graph_settings jsonb NOT NULL DEFAULT ...`
- timestamps
- index on `story_id`

#### `board_tag`

- `board_id text FK board(id) ON DELETE CASCADE`
- `name text NOT NULL`
- `created_at`
- PK `(board_id, name)`
- secondary index on `name`

The old redundant secondary index on `board_id` is removed because the PK already begins with `board_id`.

#### `graph_node`

- `id text PK`
- `board_id text NOT NULL`
- `name text NOT NULL`
- `description text NOT NULL DEFAULT ''`
- `kind text NOT NULL DEFAULT 'entity'`
- `icon_key text NULL`
- `properties jsonb NOT NULL DEFAULT '{}'`
- `x double precision NOT NULL DEFAULT 0`
- `y double precision NOT NULL DEFAULT 0`
- `width double precision NULL`
- `height double precision NULL`
- `z_index integer NOT NULL DEFAULT 0`
- `presentation jsonb NOT NULL DEFAULT ...`
- `version integer NOT NULL DEFAULT 1`
- timestamps
- UNIQUE `(id, board_id)` for composite Edge FKs
- index on `board_id`

#### `graph_edge`

- `id text PK`
- `board_id text NOT NULL`
- `source_node_id text NOT NULL`
- `target_node_id text NOT NULL`
- `direction text NOT NULL` with DB check for `DIRECTED|UNDIRECTED`
- `name text NOT NULL`
- `description text NOT NULL DEFAULT ''`
- `kind text NOT NULL DEFAULT 'relationship'`
- `icon_key text NULL`
- `properties jsonb NOT NULL DEFAULT '{}'`
- `presentation jsonb NOT NULL DEFAULT ...`
- `routing jsonb NOT NULL DEFAULT ...`
- `version integer NOT NULL DEFAULT 1`
- timestamps
- UNIQUE `(id, board_id)`
- FK `(source_node_id, board_id) → graph_node(id, board_id) ON DELETE CASCADE`
- FK `(target_node_id, board_id) → graph_node(id, board_id) ON DELETE CASCADE`
- indexes on `board_id`, `source_node_id`, `target_node_id`

No uniqueness constraint is added for `(source, target, name)`. Parallel/multiple Edges are valid.

## 6. API contracts

Existing Board-scoped route structure remains:

```text
GET    /api/v1/boards/:boardId/snapshot
POST   /api/v1/boards/:boardId/nodes
PATCH  /api/v1/boards/:boardId/nodes/:nodeId
DELETE /api/v1/boards/:boardId/nodes/:nodeId
POST   /api/v1/boards/:boardId/nodes/:nodeId/restore

POST   /api/v1/boards/:boardId/edges
PATCH  /api/v1/boards/:boardId/edges/:edgeId
DELETE /api/v1/boards/:boardId/edges/:edgeId
POST   /api/v1/boards/:boardId/edges/:edgeId/restore
```

### Node create/update additions

Create/update contracts gain:

- `kind`
- validated recursive `properties`
- `presentation`

### Edge create/update additions

Create/update contracts gain:

- `direction`
- `kind`
- validated recursive `properties`
- `presentation`
- `routing`

### CAS/version behavior

Keep row-level Node/Edge `expectedVersion` optimistic concurrency.

Every successful semantic, presentation, routing, or position update increments that row's `version`.

Inspector edits, Node movement, Node presentation changes, Edge semantic edits, Edge presentation changes, and Edge routing changes continue to serialize through the existing `node:<id>` / `edge:<id>` Save Queue lanes.

## 7. Canvas architecture

The Canvas transforms persisted semantic rows into display primitives through explicit stages:

```text
Board snapshot
    ↓
Graph semantic rows
    ↓
Relationship Bundle Resolver
    ↓
Port Resolver
    ↓
Route Resolver
    ↓
Focus/Selection Projection
    ↓
React Flow Nodes/Edges
```

These stages should be pure/testable modules wherever possible.

### 7.1 Relationship Bundle Resolver

A bundle groups every Edge between the same unordered pair of Nodes.

```ts
bundleKey = [sourceNodeId, targetNodeId].sort().join(":");
```

A bundle is computed in the frontend and **never persisted**.

It includes:

- directed A→B edges;
- directed B→A edges;
- undirected A—B edges.

The resolver determines deterministic lane ordering so reloads do not visually reorder relationships unnecessarily.

Suggested ordering:

1. undirected;
2. lower-ID → higher-ID directed;
3. higher-ID → lower-ID directed;
4. stable by Edge id inside each group.

### 7.2 Bundle rendering

One Edge between Nodes renders normally.

Multiple Edges between the same pair receive lane offsets rather than occupying the exact same path.

Default/idle view remains compact.

On hover or selection, the bundle expands/fans out enough to make each relationship label and direction individually readable.

A selected Edge remains visually primary while sibling bundle Edges receive secondary emphasis.

### 7.3 Four-direction Magnetic Ports

Replace React Flow default Node rendering with a custom Story Graph Node.

Each Node exposes connection ports at:

- top;
- right;
- bottom;
- left.

Ports are visually subtle when idle and clearly visible on Node hover, Node selection, or active connection creation.

Visible dots may remain small, but pointer hit areas must be approximately 20–24 CSS pixels for reliable mouse/trackpad use.

The graph uses loose connection behavior so every physical side can start or receive a relationship. User interaction is “connect these Nodes,” not “find the source-only side and target-only side.”

### 7.4 Magnetic target behavior

While a connection is being dragged:

- eligible target Nodes receive a subtle Graph Indigo target state;
- the nearest valid port is emphasized;
- dropping over the Node body may resolve to the nearest port rather than requiring pixel-perfect handle targeting;
- source and target IDs remain the actual semantic Edge endpoints.

The initial implementation may use React Flow connection APIs plus explicit nearest-port resolution; the architecture must not depend on one hard-coded top/bottom handle.

### 7.5 Non-drag relationship creation

Drag cannot be the only relationship creation mechanism.

When a Node is selected, provide a `관계 만들기` action.

Flow:

```text
select source Node
→ 관계 만들기
→ canvas enters target-pick mode
→ click target Node
→ Relationship dialog
→ enter name + choose directed/undirected
→ create Edge
```

This is also the keyboard-accessible alternative to drag connection.

### 7.6 Relationship dialog

After drag-drop or target-pick, do not persist an incomplete Edge immediately.

Open the relationship dialog with:

- source and target names;
- relationship name;
- `방향 있음 / 방향 없음` control;
- clear visual preview of the resulting direction;
- Cancel / Create relationship.

Cancel leaves graph data unchanged.

For a directed drag from A to B, A→B is the default orientation. The dialog may offer a `방향 바꾸기` action before creation.

## 8. Edge routing

### 8.1 Default

V2 changes the Board default from Bezier-like free curves to **orthogonal/smooth-step** routing.

Supported routing types:

- `orthogonal` — default; clean right-angle/smoothed-corner route;
- `straight` — direct line;
- `curved` — explicit curved relationship.

### 8.2 Port Resolver

When routing uses `auto` ports, choose endpoints based on relative Node geometry.

Examples:

- target primarily right of source → source.right → target.left;
- target primarily left → source.left → target.right;
- target primarily below → source.bottom → target.top;
- target primarily above → source.top → target.bottom.

The resolver must be deterministic and independent of React component state.

### 8.3 Persisted routing vs computed route

Persist only user intent/preferences:

```ts
{
  type,
  sourcePort,
  targetPort,
  waypoints
}
```

Do **not** persist the automatically computed polyline/path or bundle offset.

Computed path geometry is derived from current Node positions at render time. This prevents stale routes after Node movement and keeps automatic-layout compatibility.

### 8.4 Manual routing extension boundary

`waypoints` exists for future manual bend-point editing. V2 may leave it empty and not expose bend-point dragging yet.

## 9. Selection and Focus Mode

Dense graphs must remain navigable.

### 9.1 Node selection

Selecting a Node:

- selected Node uses strong Graph Indigo selection treatment;
- directly incident Edges remain full emphasis;
- directly connected Nodes remain normal emphasis;
- unrelated Nodes and Edges dim to approximately 20–25% opacity;
- Inspector shows the selected Node.

This behavior is visual projection only; it does not mutate graph data.

### 9.2 Edge selection

Selecting an Edge:

- selected Edge is primary;
- its source and target Nodes are emphasized;
- sibling Edges in the same bundle receive secondary emphasis;
- unrelated graph content dims;
- Inspector shows the selected Edge.

### 9.3 Clear focus

Clicking empty canvas or pressing Escape clears selection/focus when no modal workflow owns Escape.

### 9.4 Accessibility

Focus/dimming cannot make content inaccessible to keyboard navigation. Visual opacity and semantic availability are separate concerns.

## 10. Properties editor

Remove direct JSON editing from the normal Inspector.

### 10.1 UI model

The Inspector displays properties as structured rows:

```text
직업      [ 마법사                 ]
수입      [ 월 200만원             ]
사는 곳   [ 객체 ▾ ]
            나라   [ A 나라        ]
            도시   [ B 도시        ]
별명      [ 목록 ▾ ]
            [ 붉은 마법사          ]
            [ 북부의 현자          ]
            + 값 추가

+ 속성 추가
```

### 10.2 Value kinds

For editing purposes only, a property row may be:

- text;
- object;
- list.

These are structural JSON kinds, not user-domain scalar types. There is no number/date/boolean domain coercion.

### 10.3 Editing behavior

- property edits participate in the existing Inspector draft/autosave model;
- invalid structure never enters the Save Queue;
- removing a property is undoable through the same entity update history semantics where technically practical;
- keyboard controls must support adding/removing/reordering without drag dependency;
- nested indentation must remain readable in the 320px Inspector, with a future option to widen the Inspector if needed.

## 11. Presentation architecture

Presentation is stored separately from semantic meaning inside each row.

### 11.1 V2 Node presentation UI

V2 implementation may initially keep Node visuals restrained and use defaults while persisting the new presentation shape.

Future controls can expose:

- shape;
- fill color;
- border color;
- border width;
- text color;
- typography.

### 11.2 V2 Edge presentation UI

V2 should expose routing type immediately because it directly addresses readability:

```text
선 모양
[ 직선 ] [ 꺾은선 ✓ ] [ 곡선 ]
```

Advanced color/width/dash controls may remain future work while the schema supports them.

## 12. Node creation extension boundary

Current `노드 추가` action may remain during V2.

The architecture must prepare for a later left-side Node palette:

```text
[ 인물 ]
[ 사건 ]
[ 장소 ]
[ 기본 노드 ]
```

Future flow:

```text
drag Node preset
→ drop on canvas
→ compute flow position
→ open name dialog
→ create persisted Node only after confirmation
```

V2 should keep Node creation logic behind a reusable creation intent/action rather than embedding it only in the top-bar button.

## 13. Future automatic layout boundary

Do not implement a full layout engine in this V2 scope, but design rendering/state so a future layout service can return Node coordinates without rewriting semantics.

Potential future modes:

- free;
- hierarchical;
- radial;
- tree/genogram-oriented;
- force/relationship-centered;
- grid/cleanup.

An automatic layout operation ultimately produces Node position updates. Users remain free to adjust positions afterward.

Future routing engines may replace or extend the route resolver without changing persisted Edge meaning.

## 14. Story writing / AI extension boundary

Future AI consistency analysis consumes semantic graph data:

```text
Node: name, kind, description, properties
Edge: source, target, direction, name, kind, description, properties
```

It should ignore:

```text
Node position
Node presentation
Edge presentation
Edge routing
Bundle lanes
Canvas focus state
```

This separation is a core reason to keep semantic Edge statements independent instead of embedding two opposite meanings into one row.

No AI fields or document foreign keys are added to Graph tables in V2.

## 15. Undo/Redo and deletion

Preserve current session-local history and Save Queue behavior.

- Node deletion true-deletes the Node and incident Edges.
- Undo restores the full Node snapshot plus all incident Edge snapshots with identical IDs and versions.
- Edge deletion true-deletes one semantic Edge, not the visual bundle.
- Undo restores the exact Edge.
- Relationship bundle membership is recomputed automatically after delete/restore.

## 16. Performance and graph density

The design must support graph growth without changing semantics.

Initial V2 requirements:

- bundle computation is memoized from Node/Edge rows;
- focus projection is linear in graph size or better;
- avoid persisting computed paths;
- avoid unnecessary row updates during hover/focus;
- keep pointer-only state out of the backend;
- consider visible-element rendering/virtualization when graph size warrants it, without changing the data model.

No fixed Node-count promise is made for V2, but architecture must not assume a tiny 5–10 Node canvas.

## 17. Error and recovery behavior

### Connection creation

- invalid/missing endpoint → do not open create flow;
- same-Board ownership remains enforced server-side;
- save failure keeps the relationship dialog/draft recoverable where possible and exposes retry through the existing error language;
- cancelled pending connection creates no Edge.

### Autosave/CAS

- stale `expectedVersion` remains HTTP 409;
- Inspector preserves the user's local draft and exposes conflict/error rather than silently overwriting;
- move/style/routing/property edits use the same row lane to prevent local write races.

## 18. Visual design direction

Keep the existing Story Graph identity:

- quiet workspace;
- Graph Indigo only for graph action/selection emphasis;
- restrained white/silver canvas chrome;
- no decorative gradients;
- graph itself is the visual signature.

V2 signature interaction: **Magnetic Ports**.

Ports stay visually quiet until connection intent exists, then the graph becomes visibly interactive through Graph Indigo port/target states.

The boldness is spent on graph behavior rather than a broader aesthetic redesign.

## 19. Testing strategy

### Contracts/domain

Test:

- recursive properties accept strings/lists/objects;
- non-string scalar leaves reject;
- property depth/entry limits;
- free-form Node/Edge kinds;
- `DIRECTED` / `UNDIRECTED` only;
- presentation/routing defaults;
- same-Board Edge ownership;
- stale CAS conflicts.

### Pure canvas utilities

Test:

- unordered bundle key;
- deterministic bundle ordering;
- reciprocal directed edges in one bundle;
- undirected edge bundling;
- lane offsets;
- automatic port selection for all four relative directions;
- route type conversion;
- focus projection for Node/Edge selection.

### Components

Test:

- four ports render in active states;
- both directions can begin/end connections;
- relationship target-pick mode works without drag;
- connection dialog direction preview/swap/cancel;
- properties editor text/object/list interactions;
- Node selection dims unrelated graph content;
- Edge selection highlights endpoints and sibling bundle edges;
- routing selector updates Edge draft.

### Integration

Test:

- directed reciprocal Edges persist independently;
- undirected Edge persists once;
- multiple parallel Edges persist;
- recursive properties round-trip;
- Node delete cascades all incident reciprocal/parallel Edges;
- restore restores exact semantic rows.

### E2E

Primary V2 scenario:

1. Create Story and Board.
2. Add Node A and Node B.
3. Connect A→B from a side port and create directed `친구라고 생각함`.
4. Connect B→A from the opposite side and create directed `친구라고 속임`.
5. Verify both Edges render as a readable bundle.
6. Select Node A and verify connected graph emphasis/dimming.
7. Select one Edge and verify endpoints + bundle sibling emphasis.
8. Switch one Edge routing among orthogonal/straight/curved and reload.
9. Edit nested properties without raw JSON.
10. Reload and verify semantic/presentation/routing persistence.
11. Delete one Edge, Undo, reload.

## 20. Acceptance criteria

V2 is complete when:

- connection is practical from all four Node sides;
- either Node can act as source or target without the current one-sided-handle friction;
- a non-drag relationship creation path exists;
- directed reciprocal relationships are represented by independent Edges;
- symmetric relationships can be one undirected Edge;
- parallel/reciprocal Edges remain individually selectable/readable via bundle rendering;
- orthogonal routing is the Board default;
- straight/orthogonal/curved route modes persist;
- selecting a Node emphasizes its neighborhood and dims unrelated graph content;
- selecting an Edge emphasizes its endpoints and bundle siblings;
- normal Inspector property editing no longer requires raw JSON;
- recursive property values round-trip with string-only leaves;
- Node/Edge presentation and Edge routing are separate persisted concepts;
- existing CAS, Save Queue, autosave, true delete, Undo/Redo, same-Board FK guarantees remain intact;
- the Graph baseline is cleanly regenerated for pre-release reset;
- future palette creation, automatic layout, advanced styling, story writing, and AI consistency analysis can be added without another semantic graph ownership rewrite.

## 21. Decisions intentionally deferred

These are extension points, not unresolved blockers:

- specific automatic layout library/algorithm;
- manual bend-point editor UX;
- advanced Node styling controls;
- advanced Edge color/width/dash/marker controls;
- palette drag-to-create implementation;
- story document storage model;
- AI provider/model/workflow;
- property search/indexing strategy beyond current JSONB storage.

If future property search becomes important, PostgreSQL JSONB indexing or a derived search index can be introduced without changing the authoring contract.