import { describe, expect, it, vi } from "vitest";

import type { EditorCommand } from "../commands/editor-command";
import { createEditorSaveQueue } from "./editor-save-queue";

const boardId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "workspace-1";
const storyId = "11111111-1111-4111-8111-111111111111";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function flushUntilCalls(
  execute: { mock: { calls: unknown[][] } },
  expectedCalls: number,
) {
  for (let index = 0; index < 10 && execute.mock.calls.length < expectedCalls; index += 1) {
    await flushMicrotasks();
  }
}

function sequenceIds() {
  let next = 1;
  return () => `operation-${next++}`;
}

function moveNode(nodeId: string, x: number): EditorCommand {
  return {
    type: "move-node",
    boardId,
    workspaceId,
    nodeId,
    position: { x, y: x },
  };
}

function updateNode(nodeId: string, name: string): EditorCommand {
  return {
    type: "update-node",
    boardId,
    workspaceId,
    nodeId,
    version: 1,
    name,
    description: "",
    properties: {},
  };
}

function createNode(nodeId: string): EditorCommand {
  return {
    type: "create-node",
    boardId,
    workspaceId,
    storyId,
    nodeId,
    name: "New Node",
    position: { x: 100, y: 100 },
    createdAt: "2026-08-29T00:00:00.000Z",
  };
}

function createEdge(edgeId: string, sourceNodeId: string, targetNodeId: string): EditorCommand {
  return {
    type: "create-edge",
    boardId,
    workspaceId,
    storyId,
    edgeId,
    sourceNodeId,
    targetNodeId,
    name: "knows",
    createdAt: "2026-08-29T00:00:00.000Z",
  };
}

describe("EditorSaveQueue", () => {
  it("transitions saved -> unsaved -> saving -> saved", async () => {
    const gate = deferred<void>();
    const queue = createEditorSaveQueue({
      execute: vi.fn(() => gate.promise),
      createOperationId: sequenceIds(),
    });

    expect(queue.getSnapshot().saveState).toBe("saved");
    queue.enqueue(moveNode(aliceId, 100));
    expect(queue.getSnapshot().saveState).toBe("unsaved");

    await flushMicrotasks();
    expect(queue.getSnapshot().saveState).toBe("saving");

    gate.resolve();
    await flushMicrotasks();
    expect(queue.getSnapshot().saveState).toBe("saved");
  });

  it("serializes commands for the same Node lane", async () => {
    const first = deferred<void>();
    const execute = vi
      .fn<(command: EditorCommand) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = createEditorSaveQueue({ execute, createOperationId: sequenceIds() });

    queue.enqueue(createNode(aliceId));
    queue.enqueue(moveNode(aliceId, 180));
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].type).toBe("create-node");

    first.resolve();
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0]).toMatchObject({
      type: "move-node",
      position: { x: 180, y: 180 },
    });
  });

  it("lets unrelated entity lanes persist independently", async () => {
    const aliceGate = deferred<void>();
    const execute = vi.fn((command: EditorCommand) =>
      command.type === "move-node" && command.nodeId === aliceId
        ? aliceGate.promise
        : Promise.resolve(),
    );
    const queue = createEditorSaveQueue({ execute, createOperationId: sequenceIds() });

    queue.enqueue(moveNode(aliceId, 100));
    queue.enqueue(moveNode(bobId, 200));
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.map(([command]) => command)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "move-node", nodeId: aliceId }),
        expect.objectContaining({ type: "move-node", nodeId: bobId }),
      ]),
    );

    aliceGate.resolve();
    await flushMicrotasks();
  });

  it("coalesces only not-yet-started moves at the same Node lane tail", async () => {
    const first = deferred<void>();
    const execute = vi
      .fn<(command: EditorCommand) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = createEditorSaveQueue({ execute, createOperationId: sequenceIds() });

    queue.enqueue(moveNode(aliceId, 100));
    await flushMicrotasks();
    queue.enqueue(moveNode(aliceId, 120));
    queue.enqueue(moveNode(aliceId, 180));

    first.resolve();
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ position: { x: 100, y: 100 } });
    expect(execute.mock.calls[1]?.[0]).toMatchObject({ position: { x: 180, y: 180 } });
  });

  it("does not coalesce a move across a non-move barrier", async () => {
    const first = deferred<void>();
    const execute = vi
      .fn<(command: EditorCommand) => Promise<void>>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = createEditorSaveQueue({ execute, createOperationId: sequenceIds() });

    queue.enqueue(moveNode(aliceId, 100));
    await flushMicrotasks();
    queue.enqueue(moveNode(aliceId, 120));
    queue.enqueue(updateNode(aliceId, "Alicia"));
    queue.enqueue(moveNode(aliceId, 180));
    queue.enqueue(moveNode(aliceId, 220));

    first.resolve();
    await flushUntilCalls(execute, 4);

    expect(execute.mock.calls.map(([command]) => command.type)).toEqual([
      "move-node",
      "move-node",
      "update-node",
      "move-node",
    ]);
    expect(execute.mock.calls[1]?.[0]).toMatchObject({ position: { x: 120, y: 120 } });
    expect(execute.mock.calls[3]?.[0]).toMatchObject({ position: { x: 220, y: 220 } });
  });

  it("keeps a failed operation, stops only that lane, and retries manually in order", async () => {
    const retryGate = deferred<void>();
    let aliceAttempts = 0;
    const execute = vi.fn((command: EditorCommand) => {
      if (command.type === "move-node" && command.nodeId === aliceId) {
        aliceAttempts += 1;
        return aliceAttempts === 1
          ? Promise.reject(new Error("offline"))
          : retryGate.promise;
      }
      return Promise.resolve();
    });
    const queue = createEditorSaveQueue({ execute, createOperationId: sequenceIds() });

    queue.enqueue(moveNode(aliceId, 100));
    await flushMicrotasks();
    queue.enqueue(moveNode(aliceId, 180));
    queue.enqueue(moveNode(bobId, 200));
    await flushMicrotasks();
    await flushMicrotasks();

    expect(queue.getSnapshot().saveState).toBe("error");
    expect(queue.getSnapshot().failedCount).toBe(1);
    expect(queue.getSnapshot().failedOperations[0]?.command).toMatchObject({
      type: "move-node",
      nodeId: aliceId,
      position: { x: 100, y: 100 },
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ nodeId: bobId }));
    expect(execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: aliceId, position: { x: 180, y: 180 } }),
    );

    queue.retryFailed();
    await flushMicrotasks();
    expect(aliceAttempts).toBe(2);

    retryGate.resolve();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: aliceId, position: { x: 180, y: 180 } }),
    );
    expect(queue.getSnapshot().saveState).toBe("saved");
  });

  it("waits to create an Edge until active source/target Node creates are durable", async () => {
    const nodeGate = deferred<void>();
    const execute = vi.fn((command: EditorCommand) =>
      command.type === "create-node" ? nodeGate.promise : Promise.resolve(),
    );
    const queue = createEditorSaveQueue({ execute, createOperationId: sequenceIds() });

    queue.enqueue(createNode(aliceId));
    queue.enqueue(createEdge("77777777-7777-4777-8777-777777777777", aliceId, bobId));
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].type).toBe("create-node");

    nodeGate.resolve();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0].type).toBe("create-edge");
  });
});
