# Graph Editor V1 Design

Status: Approved for implementation
Date: 2026-08-28

## 1. Goal

Deliver the first usable Graph Editor vertical slice on top of the merged Graph Core backend.

The user flow is:

```text
Dashboard
  -> Story detail
  -> Board list / create Board
  -> Board Editor
  -> load snapshot
  -> create Node
  -> drag Node
  -> reload and verify persistence
```

## 2. Scope

Included:
- Dashboard Story cards navigate to `/stories/:storyId`.
- Story detail shows Story metadata and its Boards.
- Users can create a Board from Story detail.
- Board cards navigate to `/stories/:storyId/boards/:boardId`.
- Editor loads the Board snapshot through `/api/v1`.
- TanStack Query owns fetched server state.
- A per-editor Zustand store owns mutable working state.
- React Flow is only the rendering and pointer/input engine.
- `+ Node` opens a small name form; a created Node appears near the canvas center.
- Node IDs are generated client-side.
- Node drag updates Zustand continuously and persists BoardNode position only on drag stop.
- Reload hydrates the same Node ID and persisted position.

Explicitly excluded:
- Edge creation/editing.
- Canonical Node text editing after creation.
- Delete from Board.
- Undo/redo.
- Generic save queue/autosave scheduler.
- Debounced text persistence.
- Realtime collaboration, WebSocket, CRDT/Yjs.

## 3. Routes

```text
/dashboard
/stories/[storyId]
/stories/[storyId]/boards/[boardId]
```

The Story remains explicit in the Editor URL so future Story-local surfaces such as Scope, Timeline, documents, and settings fit naturally under the same route tree.

## 4. Backend API

Add one missing read endpoint:

```text
GET /api/v1/stories/:storyId/boards?workspaceId=:workspaceId
```

Response:

```json
{
  "boards": []
}
```

Use the existing Board response schema for each item.

Authorization order:
1. Resolve Story by `storyId`.
2. Verify `story.workspaceId === workspaceId`; otherwise return `404 NOT_FOUND`.
3. Require `graph:read` capability.
4. List Boards by `storyId`.

No schema migration is required.

## 5. Frontend API boundary

Add `src/frontend/api/graph/` with API functions and TanStack Query hooks for:
- `getStory` in the existing Story API module.
- `listBoards(storyId, workspaceId)`.
- `createBoard(storyId, workspaceId, name, description)`.
- `getBoardSnapshot(boardId, workspaceId)`.
- `createNodeOnBoard(boardId, request)`.
- `updateBoardNode(boardId, nodeId, request)`.

All responses are parsed with shared Zod contracts.

## 6. Editor state ownership

Create one Zustand store instance per mounted Editor page and expose it through React Context.

Store canonical and presentation data separately:

```text
nodes       canonical GraphNode[]
edges       canonical GraphEdge[]
boardNodes  BoardNode[]
boardEdges  BoardEdge[]
```

Hydration maps the snapshot directly into those collections. Do not flatten canonical Node data into BoardNode state.

React Flow nodes are derived at the UI boundary by joining `node.id === boardNode.nodeId`.

## 7. Node creation

The Editor toolbar contains `+ Node`.

Flow:
1. User enters a required trimmed name.
2. Browser generates `crypto.randomUUID()`.
3. Determine a canvas-center placement in flow coordinates.
4. Add an optimistic canonical Node + BoardNode to Zustand so the UI responds immediately.
5. POST to `/boards/:boardId/nodes`.
6. Replace optimistic entries with the validated server response.
7. If the request fails, remove the optimistic entries and show an inline error.

For V1, initial Node fields are:
- `description: ""`
- `iconKey: null`
- `properties: {}`
- `width: null`
- `height: null`
- `zIndex: 0`
- `style: {}`

## 8. Drag persistence

During drag:
- React Flow pointer events update only Zustand BoardNode `x/y`.
- Do not mutate TanStack Query cache on every frame.

On drag stop:
- PATCH `/boards/:boardId/nodes/:nodeId` with `workspaceId`, `x`, and `y`.
- On success, replace the local BoardNode with the validated response.
- On failure, preserve the local visible position and show an unsaved-position error. The next reload may revert to the last persisted position; a general retry queue is deferred.

## 9. UI composition

```text
frontend/pages/story/story-boards-page.tsx
frontend/pages/graph-editor/graph-editor-page.tsx
frontend/features/graph-editor/store/
frontend/features/graph-editor/model/
frontend/features/graph-editor/hooks/
frontend/widgets/graph-editor/graph-canvas.tsx
```

Keep React Flow-specific types in the graph canvas/widget boundary where practical. The store should not become a thin alias around React Flow internal state.

## 10. Dependencies

Add:
- `@xyflow/react`
- `zustand`

Use versions resolved by pnpm compatible with React 19 / Next 16.

## 11. Testing

TDD is required.

Backend:
- unit/application test for Story isolation + `graph:read` Board listing.
- real PostgreSQL repository/API integration for Board list response and isolation.

Frontend:
- unit test for snapshot -> editor store hydration preserving canonical/presentation separation.
- component test for Story detail Board list/create navigation.
- component/store test for optimistic Node create reconciliation/rollback where practical.
- E2E critical path: authenticated Story -> create Board -> open Editor -> create Node -> drag -> reload -> same Node and persisted position.

Final verification:
- `pnpm check`
- `pnpm test:integration`
- `pnpm build`
- `pnpm e2e`

## 12. V1 invariants

- Frontend never imports backend/Drizzle/DB.
- All app data goes through `/api/v1`.
- TanStack Query is server-state cache, not drag-frame working state.
- Zustand owns editor working state.
- React Flow is rendering/input infrastructure, not the domain model.
- Board remains presentation-only; canonical Node fields remain canonical.
- No Edge editor, undo/redo, save queue, realtime, or AI work in this slice.
