# Graph Editor V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Story -> Board -> Graph Editor navigation with snapshot hydration, Node creation, and drag-stop persistence.

**Architecture:** Extend Graph Core with one Board-list read use case/API. Frontend server state stays in TanStack Query, while each mounted Graph Editor owns a scoped Zustand working store; React Flow only derives render/input objects from canonical Node plus BoardNode presentation data.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 5.9.3, TanStack Query 5.102.3, @xyflow/react 12.11.5, Zustand 5.0.15, Zod 4.4.3, Drizzle/PostgreSQL, Vitest/RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-graph-editor-v1-design.md`

## Global Constraints

- Frontend never imports backend/Drizzle/DB.
- All application data goes through `/api/v1`.
- Board remains presentation-only; canonical Node data is not copied into BoardNode state.
- TanStack Query is server-state cache and must not own drag-frame state.
- Zustand owns editor working state per mounted Editor instance.
- React Flow is a rendering/input engine, not the domain model.
- No Edge editor, undo/redo, save queue, realtime collaboration, Scope, or AI work in this slice.

---

### Task 1: Board list backend

**Files:**
- Modify: `src/backend/modules/graph/domain/graph.repository.ts`
- Modify: `src/backend/modules/graph/infrastructure/drizzle-graph.repository.ts`
- Create: `src/backend/modules/graph/application/list-boards/list-boards.ts`
- Test: `src/backend/modules/graph/application/list-boards/list-boards.test.ts`
- Modify: `src/contracts/graph/graph.contract.ts`
- Modify: `src/app/api/v1/stories/[storyId]/boards/route.ts`
- Modify: `tests/integration/graph/graph-api.integration.ts`
- Modify: `src/backend/infrastructure/openapi/openapi-document.ts`
- Modify: `src/backend/infrastructure/openapi/openapi-document.test.ts`

**Interfaces:**
- Produces: `GraphRepository.listBoards(storyId: string): Promise<Board[]>`
- Produces: `listBoards(input, dependencies): Promise<Board[]>`
- Produces: `GET /api/v1/stories/:storyId/boards?workspaceId=... -> { boards: BoardResponse[] }`

- [ ] Write failing application tests proving Story/workspace mismatch returns 404 before capability/list lookup and valid reads require `graph:read`.
- [ ] Run the focused unit test and confirm RED because `listBoards` does not exist.
- [ ] Add the repository interface method, Drizzle implementation ordered by creation time, and application use case.
- [ ] Run the focused unit test and confirm GREEN.
- [ ] Add `listBoardsResponseSchema`, GET route, OpenAPI registration, and real PostgreSQL API integration coverage.
- [ ] Run integration/OpenAPI tests and confirm GREEN.
- [ ] Commit `feat: add board listing api`.

### Task 2: Frontend graph API and Story detail navigation

**Files:**
- Modify: `src/frontend/api/story/story.api.ts`
- Modify: `src/frontend/api/story/story.queries.ts`
- Create: `src/frontend/api/graph/graph.api.ts`
- Create: `src/frontend/api/graph/graph.queries.ts`
- Modify: `src/frontend/pages/dashboard/dashboard-page.tsx`
- Modify: `src/frontend/pages/dashboard/dashboard-page.test.tsx`
- Create: `src/frontend/pages/story/story-boards-page.tsx`
- Create: `src/frontend/pages/story/story-boards-page.test.tsx`
- Create: `src/app/(workspace)/stories/[storyId]/page.tsx`

**Interfaces:**
- Produces: `useStoryQuery(workspaceId, storyId)`
- Produces: `useBoardsQuery(workspaceId, storyId)`
- Produces: `useCreateBoardMutation(workspaceId, storyId)`

- [ ] Write failing component tests for Dashboard Story navigation and Story detail Board list/create navigation.
- [ ] Run focused frontend tests and confirm RED.
- [ ] Add API/query functions and minimal Story detail page/component.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: add story board navigation`.

### Task 3: Scoped editor store and snapshot hydration

**Files:**
- Create: `src/frontend/features/graph-editor/model/editor-types.ts`
- Create: `src/frontend/features/graph-editor/store/graph-editor-store.ts`
- Create: `src/frontend/features/graph-editor/store/graph-editor-store.test.ts`
- Create: `src/frontend/features/graph-editor/store/graph-editor-store-provider.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `createGraphEditorStore()` with `hydrate`, `addOptimisticNode`, `reconcileNode`, `removeNode`, `setNodePosition`, `replaceBoardNode`.
- Store state keeps `nodes`, `edges`, `boardNodes`, and `boardEdges` separate.

- [ ] Add package dependencies `@xyflow/react@12.11.5` and `zustand@5.0.15`.
- [ ] Write failing store tests for snapshot hydration and canonical/presentation separation.
- [ ] Run focused test and confirm RED.
- [ ] Implement the scoped vanilla Zustand store and React Context provider.
- [ ] Run focused test and confirm GREEN.
- [ ] Commit `feat: add graph editor working store`.

### Task 4: Graph canvas, Node creation, and drag-stop persistence

**Files:**
- Create: `src/frontend/widgets/graph-editor/graph-canvas.tsx`
- Create: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Create: `src/frontend/pages/graph-editor/graph-editor-page.test.tsx`
- Create: `src/app/(workspace)/stories/[storyId]/boards/[boardId]/page.tsx`
- Modify: `src/frontend/api/graph/graph.api.ts`
- Modify: `src/frontend/api/graph/graph.queries.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Snapshot query hydrates the scoped store once per Board snapshot identity.
- `createNodeOnBoard` accepts a client UUID plus initial placement.
- `updateBoardNode` persists x/y only on drag stop.

- [ ] Write failing Editor tests for snapshot rendering and `+ Node` optimistic create/reconcile behavior.
- [ ] Run focused frontend tests and confirm RED.
- [ ] Implement API functions/mutations, Editor page, and React Flow canvas derived from the Zustand store.
- [ ] Run focused tests and confirm GREEN.
- [ ] Add drag update in working state and PATCH only from `onNodeDragStop`; preserve local position on request failure and show an inline error.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: add graph editor node interactions`.

### Task 5: Persistence E2E and final verification

**Files:**
- Create: `tests/e2e/graph-editor.spec.ts`
- Modify as needed: test helpers only when required by the actual flow.

**Interfaces:**
- Critical path: authenticated user creates Story, enters Story detail, creates Board, opens Editor, creates Node, drags Node, reloads, and observes the same Node with persisted placement.

- [ ] Write the E2E test before any E2E-specific production adjustment.
- [ ] Run it and confirm RED for missing/incorrect behavior.
- [ ] Make only production changes required by the failing behavior.
- [ ] Run the E2E test and confirm GREEN.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm test:integration`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm e2e`.
- [ ] Review branch diff for architecture violations and V1 scope creep.
- [ ] Open a PR against `main`; do not merge automatically.
