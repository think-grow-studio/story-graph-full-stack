import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

async function createStoryBoardAndNode(
  context: BrowserContext,
  identityName: string,
  nodeName = "Alice",
) {
  const identity = await createE2EIdentity(identityName);
  await context.addCookies(identity.cookies);

  const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
  expect(bootstrapResponse.status()).toBe(200);
  const bootstrap = await bootstrapResponse.json();
  const workspaceId = bootstrap.workspace.id as string;

  const storyResponse = await context.request.post("/api/v1/stories", {
    data: { workspaceId, name: `${identityName} Story` },
  });
  expect(storyResponse.status()).toBe(201);
  const story = await storyResponse.json();

  const boardResponse = await context.request.post(
    `/api/v1/stories/${story.id}/boards`,
    { data: { workspaceId, name: `${identityName} Board` } },
  );
  expect(boardResponse.status()).toBe(201);
  const board = await boardResponse.json();

  const nodeId = crypto.randomUUID();
  const nodeResponse = await context.request.post(
    `/api/v1/boards/${board.id}/nodes`,
    {
      data: {
        workspaceId,
        id: nodeId,
        name: nodeName,
        position: { x: 120, y: 180 },
      },
    },
  );
  expect(nodeResponse.status()).toBe(201);

  return { identity, workspaceId, story, board, nodeId };
}

function waitForNodePatch(page: Page, nodeId: string) {
  return page.waitForResponse((response) => {
    return (
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/v1/nodes/${nodeId}`
    );
  });
}

function waitForBoardNodePatch(page: Page, boardId: string, nodeId: string) {
  return page.waitForResponse((response) => {
    return (
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname ===
        `/api/v1/boards/${boardId}/nodes/${nodeId}`
    );
  });
}

test("Graph Editor persists Node edit Undo, Redo, and final Undo across reload", async ({
  context,
  page,
}) => {
  const setup = await createStoryBoardAndNode(
    context,
    "Editor History Node User",
  );

  try {
    await page.goto(`/stories/${setup.story.id}/boards/${setup.board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const node = page.locator(`.react-flow__node[data-id="${setup.nodeId}"]`);
    await expect(node).toContainText("Alice");
    await node.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();

    const forwardPromise = waitForNodePatch(page, setup.nodeId);
    await page.getByLabel("이름").fill("Alicia");
    const forward = await forwardPromise;
    expect(forward.status()).toBe(200);
    expect(await forward.json()).toMatchObject({
      id: setup.nodeId,
      name: "Alicia",
      version: 2,
    });
    await expect(page.getByText("저장됨")).toBeVisible();
    await expect(node).toContainText("Alicia");

    const undoPromise = waitForNodePatch(page, setup.nodeId);
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      id: setup.nodeId,
      name: "Alice",
      version: 3,
    });
    await expect(page.getByLabel("이름")).toHaveValue("Alice");
    await expect(node).toContainText("Alice");
    await expect(page.getByText("저장됨")).toBeVisible();

    const redoPromise = waitForNodePatch(page, setup.nodeId);
    await page.getByRole("button", { name: "Redo" }).click();
    const redo = await redoPromise;
    expect(redo.status()).toBe(200);
    expect(await redo.json()).toMatchObject({
      id: setup.nodeId,
      name: "Alicia",
      version: 4,
    });
    await expect(page.getByLabel("이름")).toHaveValue("Alicia");
    await expect(node).toContainText("Alicia");
    await expect(page.getByText("저장됨")).toBeVisible();

    const finalUndoPromise = waitForNodePatch(page, setup.nodeId);
    await page.getByRole("button", { name: "Undo" }).click();
    const finalUndo = await finalUndoPromise;
    expect(finalUndo.status()).toBe(200);
    expect(await finalUndo.json()).toMatchObject({
      id: setup.nodeId,
      name: "Alice",
      version: 5,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__node[data-id="${setup.nodeId}"]`),
    ).toContainText("Alice");
    await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.board.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: setup.nodeId,
        name: "Alice",
        version: 5,
      }),
    );
  } finally {
    await cleanupE2EIdentity(setup.identity);
  }
});

test("Graph Editor persists drag Undo back to the original Board position", async ({
  context,
  page,
}) => {
  const setup = await createStoryBoardAndNode(
    context,
    "Editor History Drag User",
    "Drag Node",
  );

  try {
    const initialSnapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.board.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(initialSnapshotResponse.status()).toBe(200);
    const initialSnapshot = await initialSnapshotResponse.json();
    const initialPlacement = initialSnapshot.boardNodes.find(
      (boardNode: { nodeId: string }) => boardNode.nodeId === setup.nodeId,
    );
    expect(initialPlacement).toMatchObject({
      nodeId: setup.nodeId,
      x: 120,
      y: 180,
    });

    await page.goto(`/stories/${setup.story.id}/boards/${setup.board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    const node = page.locator(`.react-flow__node[data-id="${setup.nodeId}"]`);
    await expect(node).toContainText("Drag Node");

    const box = await node.boundingBox();
    expect(box).not.toBeNull();

    const movePromise = waitForBoardNodePatch(
      page,
      setup.board.id,
      setup.nodeId,
    );
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 140,
      box!.y + box!.height / 2 + 100,
      { steps: 8 },
    );
    await page.mouse.up();

    const move = await movePromise;
    expect(move.status()).toBe(200);
    const movedPlacement = await move.json();
    expect({ x: movedPlacement.x, y: movedPlacement.y }).not.toEqual({
      x: initialPlacement.x,
      y: initialPlacement.y,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    const undoPromise = waitForBoardNodePatch(
      page,
      setup.board.id,
      setup.nodeId,
    );
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      nodeId: setup.nodeId,
      x: initialPlacement.x,
      y: initialPlacement.y,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const finalSnapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.board.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(finalSnapshotResponse.status()).toBe(200);
    const finalSnapshot = await finalSnapshotResponse.json();
    expect(finalSnapshot.boardNodes).toContainEqual(
      expect.objectContaining({
        nodeId: setup.nodeId,
        x: initialPlacement.x,
        y: initialPlacement.y,
      }),
    );
  } finally {
    await cleanupE2EIdentity(setup.identity);
  }
});
