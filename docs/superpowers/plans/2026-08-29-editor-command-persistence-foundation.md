# Editor Command / Persistence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Graph Editor write orchestration out of the page into pure Editor commands, a command executor, and a mockable persistence adapter without changing observable behavior.

**Architecture:** Commands are plain frontend data and never import Axios, React Flow, backend, or database types. `executeEditorCommand()` owns local Zustand transition/reconcile/rollback semantics while `EditorPersistence` owns durable writes. The concrete React hook adapter wraps the existing TanStack mutation hooks so snapshot-cache synchronization and mutation lifecycle behavior stay unchanged.

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, TanStack Query 5, Vitest 4, Playwright 1.62.

**Spec:** `story-graph-ai-handoff-2026-08-29.md` §17 — “다음 Slice 1 — Editor Command / Persistence foundation”.

## Global Constraints

- Preserve the current observable Graph Editor behavior exactly.
- Board remains a View; canonical Node/Edge data remains Story-owned.
- PostgreSQL is durable truth, TanStack Query is fetched/cache/mutation lifecycle, Zustand is editor working state, React Flow is rendering/input only.
- Do not full-hydrate Zustand again when same-Board snapshot cache changes.
- Command code must not call Axios directly.
- Command types must not use React Flow types.
- This slice does not implement Save Queue, visible save state, autosave, undo/redo, realtime, collaboration, or DB transaction history undo.
- Frontend/backend HTTP boundary remains `/api/v1`; frontend must not import backend/Drizzle code.

---

### Task 1: Define pure Editor command model and executor

**Files:**
- Create: `src/frontend/features/graph-editor/commands/editor-command.ts`
- Create: `src/frontend/features/graph-editor/commands/node-commands.ts`
- Create: `src/frontend/features/graph-editor/commands/edge-commands.ts`
- Create: `src/frontend/features/graph-editor/commands/editor-command-executor.ts`
- Create: `src/frontend/features/graph-editor/commands/editor-command-executor.test.ts`
- Read: `src/frontend/features/graph-editor/store/graph-editor-store.ts`
- Read: `src/frontend/features/graph-editor/model/editor-types.ts`

**Interfaces:**
- Produces `EditorCommand`, a discriminated union over seven current write operations.
- Produces `executeEditorCommand(store, persistence, command): Promise<void>`.
- Consumes `GraphEditorStore` and `EditorPersistence` only; no React components or HTTP client.

- [ ] **Step 1: Write the failing executor tests**

Cover all current local transition contracts with a mocked `EditorPersistence`:

```ts
it("optimistically creates and reconciles a Node", async () => {
  const store = hydratedStore();
  persistence.createNode.mockResolvedValue(persistedNodePair);

  await executeEditorCommand(store, persistence, createNodeCommand);

  expect(persistence.createNode).toHaveBeenCalledWith(createNodeCommand);
  expect(store.getState().nodes).toContainEqual(persistedNodePair.node);
  expect(store.getState().boardNodes).toContainEqual(persistedNodePair.boardNode);
});

it("rolls back an optimistic Node when persistence fails", async () => {
  persistence.createNode.mockRejectedValue(new Error("offline"));
  await expect(
    executeEditorCommand(store, persistence, createNodeCommand),
  ).rejects.toThrow("offline");
  expect(store.getState().nodes.some((node) => node.id === createNodeCommand.nodeId)).toBe(false);
});

it("keeps the latest working position when move persistence fails", async () => {
  persistence.moveNode.mockRejectedValue(new Error("offline"));
  await expect(executeEditorCommand(store, persistence, moveNodeCommand)).rejects.toThrow();
  expect(currentBoardNode(store, moveNodeCommand.nodeId)).toMatchObject({
    x: moveNodeCommand.position.x,
    y: moveNodeCommand.position.y,
  });
});

it("rolls back Board presentation only when Board Node removal fails", async () => {
  persistence.removeBoardNode.mockRejectedValue(new Error("offline"));
  await expect(executeEditorCommand(store, persistence, removeNodeCommand)).rejects.toThrow();
  expect(store.getState().nodes.map((node) => node.id)).toContain(removeNodeCommand.nodeId);
  expect(store.getState().boardNodes.map((node) => node.nodeId)).toContain(removeNodeCommand.nodeId);
});
```

Also cover create Edge reconcile/rollback, canonical Node update, canonical Edge update, and Board Edge detach/rollback.

- [ ] **Step 2: Run the focused test and capture RED**

Run:

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-executor.test.ts
```

Expected: FAIL because command modules and executor do not exist.

- [ ] **Step 3: Add command types**

`node-commands.ts`:

```ts
export type CreateNodeCommand = {
  type: "create-node";
  boardId: string;
  workspaceId: string;
  storyId: string;
  nodeId: string;
  name: string;
  position: { x: number; y: number };
  createdAt: string;
};

export type MoveNodeCommand = {
  type: "move-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  position: { x: number; y: number };
};

export type UpdateNodeCommand = {
  type: "update-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  version: number;
  name: string;
  description: string;
  properties: Record<string, unknown>;
};

export type RemoveBoardNodeCommand = {
  type: "remove-board-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
};
```

`edge-commands.ts` mirrors this with `create-edge`, `update-edge`, and `remove-board-edge`. `editor-command.ts` exports their discriminated union.

- [ ] **Step 4: Implement minimal command executor**

Use existing Zustand methods rather than duplicating store rules. Create optimistic entities only inside the executor for create commands. Preserve current behavior:

```ts
export async function executeEditorCommand(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  command: EditorCommand,
): Promise<void> {
  switch (command.type) {
    case "create-node": {
      store.getState().addOptimisticNode(toOptimisticNodePair(command));
      try {
        store.getState().reconcileNode(await persistence.createNode(command));
      } catch (error) {
        store.getState().removeNode(command.nodeId);
        throw error;
      }
      return;
    }
    case "move-node": {
      store.getState().setNodePosition(command.nodeId, command.position);
      const persisted = await persistence.moveNode(command);
      store.getState().replaceBoardNode(persisted);
      return;
    }
    case "create-edge": {
      store.getState().addOptimisticEdge(toOptimisticEdgePair(command));
      try {
        store.getState().reconcileEdge(await persistence.createEdge(command));
      } catch (error) {
        store.getState().removeEdge(command.edgeId);
        throw error;
      }
      return;
    }
    case "update-node":
      store.getState().replaceNode(await persistence.updateNode(command));
      return;
    case "update-edge":
      store.getState().replaceEdge(await persistence.updateEdge(command));
      return;
    case "remove-board-node": {
      const detached = store.getState().detachNodeFromBoard(command.nodeId);
      if (!detached.boardNode) return;
      try {
        await persistence.removeBoardNode(command);
      } catch (error) {
        store.getState().restoreNodeToBoard(detached);
        throw error;
      }
      return;
    }
    case "remove-board-edge": {
      const detached = store.getState().detachEdgeFromBoard(command.edgeId);
      if (!detached) return;
      try {
        await persistence.removeBoardEdge(command);
      } catch (error) {
        store.getState().restoreEdgeToBoard(detached);
        throw error;
      }
    }
  }
}
```

- [ ] **Step 5: Run focused tests to GREEN**

```bash
pnpm test -- src/frontend/features/graph-editor/commands/editor-command-executor.test.ts
```

Expected: all executor tests PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/frontend/features/graph-editor/commands
git commit -m "feat: add graph editor command executor"
```

---

### Task 2: Add mockable persistence boundary backed by existing TanStack mutations

**Files:**
- Create: `src/frontend/features/graph-editor/persistence/editor-persistence.ts`
- Create: `src/frontend/features/graph-editor/persistence/use-editor-persistence.ts`
- Test: `src/frontend/features/graph-editor/commands/editor-command-executor.test.ts`
- Read: `src/frontend/api/graph/graph.queries.ts`

**Interfaces:**
- Produces `EditorPersistence` with one method per command family.
- Produces `useEditorPersistence(workspaceId, boardId)` returning `{ persistence, pending }`.
- Keeps existing TanStack mutation hooks as the concrete HTTP/cache implementation.

- [ ] **Step 1: Define persistence interface**

```ts
export type EditorPersistence = {
  createNode: (command: CreateNodeCommand) => Promise<GraphEditorNodePair>;
  moveNode: (command: MoveNodeCommand) => Promise<BoardNodeResponse>;
  createEdge: (command: CreateEdgeCommand) => Promise<GraphEditorEdgePair>;
  updateNode: (command: UpdateNodeCommand) => Promise<GraphNodeResponse>;
  updateEdge: (command: UpdateEdgeCommand) => Promise<GraphEdgeResponse>;
  removeBoardNode: (command: RemoveBoardNodeCommand) => Promise<void>;
  removeBoardEdge: (command: RemoveBoardEdgeCommand) => Promise<void>;
};
```

This is the test seam used by Task 1; tests construct an object of mocked functions without React Query or Axios.

- [ ] **Step 2: Implement React persistence adapter**

`use-editor-persistence.ts` creates the seven existing mutation hooks and maps commands to their current API inputs. Do not reimplement Query cache logic; canonical update/removal cache behavior must continue to come from `graph.queries.ts`.

```ts
export function useEditorPersistence(
  workspaceId: string | undefined,
  boardId: string,
) {
  const createNode = useCreateNodeOnBoardMutation();
  const createEdge = useCreateEdgeOnBoardMutation();
  const updateNode = useUpdateNodeMutation(workspaceId, boardId);
  const updateEdge = useUpdateEdgeMutation(workspaceId, boardId);
  const moveNode = useUpdateBoardNodeMutation();
  const removeNode = useRemoveNodeFromBoardMutation(workspaceId, boardId);
  const removeEdge = useRemoveEdgeFromBoardMutation(workspaceId, boardId);

  const persistence: EditorPersistence = {
    createNode: (command) => createNode.mutateAsync({
      boardId: command.boardId,
      workspaceId: command.workspaceId,
      id: command.nodeId,
      name: command.name,
      position: command.position,
    }),
    moveNode: (command) => moveNode.mutateAsync({
      boardId: command.boardId,
      nodeId: command.nodeId,
      workspaceId: command.workspaceId,
      x: command.position.x,
      y: command.position.y,
    }),
    createEdge: (command) => createEdge.mutateAsync({
      boardId: command.boardId,
      workspaceId: command.workspaceId,
      id: command.edgeId,
      sourceNodeId: command.sourceNodeId,
      targetNodeId: command.targetNodeId,
      name: command.name,
    }),
    updateNode: (command) => updateNode.mutateAsync(command),
    updateEdge: (command) => updateEdge.mutateAsync(command),
    removeBoardNode: (command) => removeNode.mutateAsync(command),
    removeBoardEdge: (command) => removeEdge.mutateAsync(command),
  };

  return {
    persistence,
    pending: {
      createNode: createNode.isPending,
      createEdge: createEdge.isPending,
      updateNode: updateNode.isPending,
      updateEdge: updateEdge.isPending,
      moveNode: moveNode.isPending,
      removeBoardNode: removeNode.isPending,
      removeBoardEdge: removeEdge.isPending,
    },
  };
}
```

When mapping update/remove commands, explicitly strip command-only `type`/`boardId` fields rather than passing the discriminated object directly to API mutation input types.

- [ ] **Step 3: Run architecture/type/unit checks**

```bash
pnpm check
```

Expected: command code has no forbidden imports and TypeScript confirms the adapter mapping.

- [ ] **Step 4: Commit Task 2**

```bash
git add src/frontend/features/graph-editor/persistence src/frontend/features/graph-editor/commands
git commit -m "feat: add editor persistence adapter"
```

---

### Task 3: Refactor Graph Editor page onto commands without behavior changes

**Files:**
- Modify: `src/frontend/pages/graph-editor/graph-editor-page.tsx`
- Existing tests exercised: `src/frontend/pages/graph-editor/graph-editor-page.test.tsx`
- Existing tests exercised: `src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx`
- Existing tests exercised: `src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx`
- Existing tests exercised: `src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx`
- Existing tests exercised: `src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx`

**Interfaces:**
- Consumes `executeEditorCommand()` and `useEditorPersistence()`.
- Page remains responsible only for UI/form state, selection, command construction, and user-facing error messages.

- [ ] **Step 1: Replace seven mutation-hook imports**

Keep `useBoardSnapshotQuery` but replace editor write mutation imports with:

```ts
import { executeEditorCommand } from "@/frontend/features/graph-editor/commands/editor-command-executor";
import { useEditorPersistence } from "@/frontend/features/graph-editor/persistence/use-editor-persistence";
```

Initialize:

```ts
const { persistence, pending } = useEditorPersistence(workspaceId, boardId);
```

- [ ] **Step 2: Convert handlers to command construction**

Create Node:

```ts
await executeEditorCommand(store, persistence, {
  type: "create-node",
  boardId,
  workspaceId,
  storyId: snapshot.data.story.id,
  nodeId: crypto.randomUUID(),
  name,
  position,
  createdAt: new Date().toISOString(),
});
```

Move Node uses the already-current Zustand BoardNode position, then executes a `move-node` command. Update Node/Edge commands include the current canonical `version`; 409 user-facing messages stay in the page catch block. Board removal commands preserve the current successful selection clearing and current failure Inspector/error behavior.

- [ ] **Step 3: Preserve pending UI semantics**

Replace direct mutation `.isPending` reads with the corresponding `pending.*` booleans. Do not add a generic save status in this slice.

- [ ] **Step 4: Run focused frontend regression tests**

```bash
pnpm test -- \
  src/frontend/pages/graph-editor/graph-editor-page.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-edge-failure.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-inspector.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal.test.tsx \
  src/frontend/pages/graph-editor/graph-editor-board-removal-failure.test.tsx
```

Expected: existing behavior tests PASS unchanged except for mock wiring required by the new persistence hook boundary.

- [ ] **Step 5: Run full unit/architecture gate**

```bash
pnpm check
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/frontend/pages/graph-editor src/frontend/features/graph-editor
 git commit -m "refactor: route editor writes through commands"
```

---

### Task 4: Full verification and PR evidence

**Files:**
- Modify only if needed: `docs/superpowers/plans/2026-08-29-editor-command-persistence-foundation.md`
- No schema/migration changes expected.

- [ ] **Step 1: Run full CI-equivalent verification**

```bash
pnpm check
pnpm test:integration
pnpm build
git diff --exit-code
pnpm e2e
```

Expected: architecture/AGENTS, lint, typecheck, unit, integration, build, clean-tree, and E2E all PASS.

- [ ] **Step 2: Direct diff review against invariants**

Verify:
- no Axios import in `commands/`
- no React Flow type in command model
- no backend/Drizzle frontend import
- no canonical DELETE introduced
- same-Board full rehydration guard unchanged
- existing TanStack snapshot-cache update behavior retained
- move failure still keeps working position
- create/removal failure rollback semantics unchanged
- no Save Queue/autosave/undo scope creep

- [ ] **Step 3: Open a Draft PR from `feat/editor-command-persistence-foundation` to `main`**

PR body must record the RED checkpoint, final head SHA, CI run number/id, exact unit/integration/E2E counts, direct review result, and explicitly state that Save Queue is deferred to the next slice.
