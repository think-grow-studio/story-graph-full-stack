import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";
import {
  createE2EBoard,
  createE2ENode,
  createE2EStory,
} from "./helpers/graph-fixtures";

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
  const { workspace } = await bootstrapResponse.json();
  const workspaceId = workspace.id as string;

  const story = await createE2EStory(
    context.request,
    workspaceId,
    `${identityName} Story`,
  );
  const board = await createE2EBoard(
    context.request,
    story.id,
    workspaceId,
    `${identityName} Board`,
  );
  const node = await createE2ENode(context.request, board.id, workspaceId, {
    name: nodeName,
    x: 120,
    y: 180,
  });

  return { identity, workspaceId, story, board, node };
}

function waitForNodePatch(page: Page, boardId: string, nodeId: string) {
  return page.waitForResponse((response) =>
    response.request().method() === "PATCH" &&
    new URL(response.url()).pathname ===
      `/api/v1/boards/${boardId}/nodes/${nodeId}`,
  );
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

    const node = page.locator(`.react-flow__node[data-id="${setup.node.id}"]`);
    await expect(node).toContainText("Alice");
    await node.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();

    const forwardPromise = waitForNodePatch(page, setup.board.id, setup.node.id);
    await page.getByLabel("이름").fill("Alicia");
    const forward = await forwardPromise;
    expect(forward.status()).toBe(200);
    expect(await forward.json()).toMatchObject({
      id: setup.node.id,
      boardId: setup.board.id,
      name: "Alicia",
      version: 2,
    });
    await expect(page.getByText("저장됨")).toBeVisible();
    await expect(node).toContainText("Alicia");

    const undoPromise = waitForNodePatch(page, setup.board.id, setup.node.id);
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      id: setup.node.id,
      name: "Alice",
      version: 3,
    });
    await expect(page.getByLabel("이름")).toHaveValue("Alice");
    await expect(node).toContainText("Alice");
    await expect(page.getByText("저장됨")).toBeVisible();

    const redoPromise = waitForNodePatch(page, setup.board.id, setup.node.id);
    await page.getByRole("button", { name: "Redo" }).click();
    const redo = await redoPromise;
    expect(redo.status()).toBe(200);
    expect(await redo.json()).toMatchObject({
      id: setup.node.id,
      name: "Alicia",
      version: 4,
    });
    await expect(page.getByLabel("이름")).toHaveValue("Alicia");
    await expect(node).toContainText("Alicia");
    await expect(page.getByText("저장됨")).toBeVisible();

    const finalUndoPromise = waitForNodePatch(page, setup.board.id, setup.node.id);
    await page.getByRole("button", { name: "Undo" }).click();
    const finalUndo = await finalUndoPromise;
    expect(finalUndo.status()).toBe(200);
    expect(await finalUndo.json()).toMatchObject({
      id: setup.node.id,
      name: "Alice",
      version: 5,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__node[data-id="${setup.node.id}"]`),
    ).toContainText("Alice");
    await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.board.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: setup.node.id,
        boardId: setup.board.id,
        name: "Alice",
        version: 5,
      }),
    );
  } finally {
    await cleanupE2EIdentity(setup.identity);
  }
});

test("Graph Editor persists drag Undo back to the original Node position", async ({
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
    const initialNode = initialSnapshot.nodes.find(
      (candidate: { id: string }) => candidate.id === setup.node.id,
    );
    expect(initialNode).toMatchObject({
      id: setup.node.id,
      x: 120,
      y: 180,
      version: 1,
    });

    await page.goto(`/stories/${setup.story.id}/boards/${setup.board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    const node = page.locator(`.react-flow__node[data-id="${setup.node.id}"]`);
    await expect(node).toContainText("Drag Node");

    const box = await node.boundingBox();
    expect(box).not.toBeNull();

    const movePromise = waitForNodePatch(page, setup.board.id, setup.node.id);
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
    const movedNode = await move.json();
    expect(movedNode).toMatchObject({
      id: setup.node.id,
      boardId: setup.board.id,
      version: 2,
    });
    expect({ x: movedNode.x, y: movedNode.y }).not.toEqual({
      x: initialNode.x,
      y: initialNode.y,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    const undoPromise = waitForNodePatch(page, setup.board.id, setup.node.id);
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      id: setup.node.id,
      x: initialNode.x,
      y: initialNode.y,
      version: 3,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const finalSnapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.board.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(finalSnapshotResponse.status()).toBe(200);
    const finalSnapshot = await finalSnapshotResponse.json();
    expect(finalSnapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: setup.node.id,
        x: initialNode.x,
        y: initialNode.y,
        version: 3,
      }),
    );
  } finally {
    await cleanupE2EIdentity(setup.identity);
  }
});
