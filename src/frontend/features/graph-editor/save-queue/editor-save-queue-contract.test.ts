import { describe, expect, it, vi } from "vitest";

import type { EditorCommand } from "../commands/editor-command";
import {
  createEditorSaveQueue,
  getEditorCommandLaneKey,
} from "./editor-save-queue";

const boardId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "workspace-1";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "77777777-7777-4777-8777-777777777777";
const createdAt = "2026-09-06T00:00:00.000Z";

function moveNode(nodeId: string, x = 100): EditorCommand {
  return {
    type: "move-node",
    boardId,
    workspaceId,
    nodeId,
    expectedVersion: 1,
    position: { x, y: x },
  };
}

function createNode(nodeId: string): EditorCommand {
  return {
    type: "create-node",
    boardId,
    workspaceId,
    nodeId,
    name: "Node",
    position: { x: 0, y: 0 },
    createdAt,

    description: "",
    kind: "entity",
    iconKey: null,
    properties: {},
    width: null,
    height: null,
    zIndex: 0,
    presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
  };
}

function createEdge(id = edgeId): EditorCommand {
  return {
    type: "create-edge",
    boardId,
    workspaceId,
    edgeId: id,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    createdAt,

    direction: "DIRECTED",
    description: "",
    kind: "relationship",
    iconKey: null,
    properties: {},
    presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
    routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("EditorSaveQueue Board-owned contract", () => {
  it("uses one lane per direct Node or Edge for every command type", () => {
    const nodeCommands: EditorCommand[] = [
      createNode(aliceId),
      moveNode(aliceId),
      {
        type: "update-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        expectedVersion: 1,
        name: "Alice",
        description: "",
        properties: {},

        kind: "entity",
        iconKey: null,
        presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
      },
      { type: "delete-node", boardId, workspaceId, nodeId: aliceId },
      {
        type: "restore-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        node: {
          id: aliceId,
          boardId,
          name: "Alice",
          description: "",
          iconKey: null,
          properties: {},
          x: 0,
          y: 0,
          width: null,
          height: null,
          zIndex: 0,
          presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
          version: 1,
          createdAt,
          updatedAt: createdAt,

          kind: "entity",
        },
        edges: [],
      },
    ];
    const edgeCommands: EditorCommand[] = [
      createEdge(),
      {
        type: "update-edge",
        boardId,
        workspaceId,
        edgeId,
        expectedVersion: 1,
        name: "knows",
        description: "",
        properties: {},

        direction: "DIRECTED",
        kind: "relationship",
        iconKey: null,
        presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
        routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
      },
      { type: "delete-edge", boardId, workspaceId, edgeId },
      {
        type: "restore-edge",
        boardId,
        workspaceId,
        edgeId,
        edge: {
          id: edgeId,
          boardId,
          sourceNodeId: aliceId,
          targetNodeId: bobId,
          name: "knows",
          description: "",
          iconKey: null,
          properties: {},
          presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
          routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
          version: 1,
          createdAt,
          updatedAt: createdAt,

          direction: "DIRECTED",
          kind: "relationship",
        },
      },
    ];

    for (const command of nodeCommands) {
      expect(getEditorCommandLaneKey(command)).toBe(`node:${aliceId}`);
    }
    for (const command of edgeCommands) {
      expect(getEditorCommandLaneKey(command)).toBe(`edge:${edgeId}`);
    }
  });

  it("returns a cached snapshot until queue state changes", () => {
    const queue = createEditorSaveQueue({
      execute: vi.fn().mockResolvedValue(undefined),
      createOperationId: () => "operation-1",
    });

    const initial = queue.getSnapshot();
    expect(queue.getSnapshot()).toBe(initial);

    queue.enqueue(moveNode(aliceId));
    const pending = queue.getSnapshot();
    expect(pending).not.toBe(initial);
    expect(queue.getSnapshot()).toBe(pending);
  });

  it("records operation id, lane key, and incrementing failure attempt", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("offline"));
    const queue = createEditorSaveQueue({
      execute,
      createOperationId: () => "operation-1",
    });

    queue.enqueue(moveNode(aliceId));
    await flushMicrotasks();

    expect(queue.getSnapshot().failedOperations[0]).toMatchObject({
      operationId: "operation-1",
      laneKey: `node:${aliceId}`,
      attempt: 1,
    });

    queue.retryFailed();
    await flushMicrotasks();

    expect(queue.getSnapshot().failedOperations[0]).toMatchObject({
      operationId: "operation-1",
      laneKey: `node:${aliceId}`,
      attempt: 2,
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("keeps an Edge blocked until both active endpoint creates succeed", async () => {
    let resolveAlice!: () => void;
    let resolveBob!: () => void;
    const alice = new Promise<void>((resolve) => {
      resolveAlice = resolve;
    });
    const bob = new Promise<void>((resolve) => {
      resolveBob = resolve;
    });
    const execute = vi.fn((command: EditorCommand) => {
      if (command.type === "create-node" && command.nodeId === aliceId) return alice;
      if (command.type === "create-node" && command.nodeId === bobId) return bob;
      return Promise.resolve();
    });
    let operation = 0;
    const queue = createEditorSaveQueue({
      execute,
      createOperationId: () => `operation-${++operation}`,
    });

    queue.enqueue(createNode(aliceId));
    queue.enqueue(createNode(bobId));
    await flushMicrotasks();
    queue.enqueue(createEdge());
    await flushMicrotasks();
    expect(execute).toHaveBeenCalledTimes(2);

    resolveAlice();
    await flushMicrotasks();
    expect(execute).toHaveBeenCalledTimes(2);

    resolveBob();
    await flushMicrotasks();
    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls[2]?.[0].type).toBe("create-edge");
  });

  it("lets a Node delete wait for incident Edge lanes supplied by the caller", async () => {
    let resolveEdge!: () => void;
    const edgeSave = new Promise<void>((resolve) => {
      resolveEdge = resolve;
    });
    const execute = vi.fn((command: EditorCommand) =>
      command.type === "update-edge" ? edgeSave : Promise.resolve(),
    );
    let operation = 0;
    const queue = createEditorSaveQueue({
      execute,
      createOperationId: () => `operation-${++operation}`,
    });

    queue.enqueue({
      type: "update-edge",
      boardId,
      workspaceId,
      edgeId,
      expectedVersion: 1,
      name: "knows",
      description: "",
      properties: {},

      direction: "DIRECTED",
      kind: "relationship",
      iconKey: null,
      presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
      routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
    });
    await flushMicrotasks();
    queue.enqueue(
      { type: "delete-node", boardId, workspaceId, nodeId: aliceId },
      { waitForLaneKeys: [`edge:${edgeId}`] },
    );
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(1);
    resolveEdge();
    await flushMicrotasks();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0].type).toBe("delete-node");
  });
});
