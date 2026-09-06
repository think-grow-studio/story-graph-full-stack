import { describe, expect, it, vi } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import type { EditorCommand } from "../commands/editor-command";
import { applyEditorCommand } from "../commands/editor-command-runtime";
import type { EditorPersistence } from "../persistence/editor-persistence";
import { createEditorPersistenceRuntime } from "../save-queue/editor-persistence-runtime";
import { createEditorSaveQueue } from "../save-queue/editor-save-queue";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { createEditorHistory } from "./editor-history";
import { createEditorHistoryEntry } from "./editor-history-entry";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const workspaceId = "workspace-1";
const now = "2026-09-06T00:00:00.000Z";

function node(id: string, name: string, x: number): GraphNodeResponse {
  return {
    id,
    boardId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    x,
    y: 0,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version: 2,
    createdAt: now,
    updatedAt: now,
  };
}

function relationship(): GraphEdgeResponse {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    description: "",
    iconKey: null,
    properties: {},
    style: {},
    labelPresentation: {},
    version: 3,
    createdAt: now,
    updatedAt: now,
  };
}

function createStore() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    nodes: [node(aliceId, "Alice", 0), node(bobId, "Bob", 200)],
    edges: [relationship()],
  });
  return store;
}

function createPersistence() {
  const restoreNode = vi.fn().mockImplementation(async (command) => ({
    node: command.node,
    edges: command.edges,
  }));
  const persistence: EditorPersistence = {
    createNode: vi.fn(),
    moveNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn().mockResolvedValue(undefined),
    restoreNode,
    createEdge: vi.fn(),
    updateEdge: vi.fn(),
    deleteEdge: vi.fn().mockResolvedValue(undefined),
    restoreEdge: vi.fn(),
  };
  return { persistence, restoreNode };
}

async function flushQueue() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("editor history + Save Queue", () => {
  it("persists Node delete, Undo restore, and Redo delete with the captured identities", async () => {
    const store = createStore();
    const { persistence, restoreNode } = createPersistence();
    const runtime = createEditorPersistenceRuntime(store);
    runtime.setPersistence(persistence);
    let operation = 0;
    const queue = createEditorSaveQueue({
      execute: runtime.execute,
      createOperationId: () => `operation-${++operation}`,
    });
    queue.activate();
    const history = createEditorHistory();

    const forward: EditorCommand = {
      type: "delete-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
    };
    const entry = createEditorHistoryEntry({ store, command: forward, nowMs: 1 });
    expect(entry).not.toBeNull();

    expect(applyEditorCommand(store, forward)).toBe(true);
    queue.enqueue(forward);
    history.record(entry!);
    await flushQueue();

    expect(persistence.deleteNode).toHaveBeenCalledWith(forward);
    expect(store.getState().nodes.some((item) => item.id === aliceId)).toBe(false);
    expect(store.getState().edges).toHaveLength(0);

    const replay = (command: EditorCommand) => {
      if (!applyEditorCommand(store, command)) return false;
      queue.enqueue(command);
      return true;
    };

    expect(history.undo(replay)).toBe(true);
    await flushQueue();
    expect(restoreNode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "restore-node",
        nodeId: aliceId,
        node: expect.objectContaining({ id: aliceId }),
        edges: [expect.objectContaining({ id: edgeId })],
      }),
    );
    expect(store.getState().nodes.some((item) => item.id === aliceId)).toBe(true);
    expect(store.getState().edges.some((item) => item.id === edgeId)).toBe(true);

    expect(history.redo(replay)).toBe(true);
    await flushQueue();
    expect(persistence.deleteNode).toHaveBeenCalledTimes(2);
    expect(store.getState().nodes.some((item) => item.id === aliceId)).toBe(false);
    expect(store.getState().edges).toHaveLength(0);

    queue.dispose();
  });
});