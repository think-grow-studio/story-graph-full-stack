import { describe, expect, it, vi } from "vitest";

import type { EditorCommand } from "../commands/editor-command";
import {
  createEditorSaveQueue,
  getEditorCommandLaneKey,
} from "./editor-save-queue";

const boardId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "workspace-1";
const storyId = "11111111-1111-4111-8111-111111111111";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";

function moveNode(nodeId: string, x = 100): EditorCommand {
  return {
    type: "move-node",
    boardId,
    workspaceId,
    nodeId,
    position: { x, y: x },
  };
}

function createNode(nodeId: string): EditorCommand {
  return {
    type: "create-node",
    boardId,
    workspaceId,
    storyId,
    nodeId,
    name: "Node",
    position: { x: 0, y: 0 },
    createdAt: "2026-08-29T00:00:00.000Z",
  };
}

function createEdge(edgeId: string): EditorCommand {
  return {
    type: "create-edge",
    boardId,
    workspaceId,
    storyId,
    edgeId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    createdAt: "2026-08-29T00:00:00.000Z",
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("EditorSaveQueue contract", () => {
  it("exposes stable lane keys", () => {
    expect(getEditorCommandLaneKey(moveNode(aliceId))).toBe(`node:${aliceId}`);
    expect(getEditorCommandLaneKey(createEdge("77777777-7777-4777-8777-777777777777"))).toBe(
      "edge:77777777-7777-4777-8777-777777777777",
    );
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
    queue.enqueue(createEdge("77777777-7777-4777-8777-777777777777"));
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
});
