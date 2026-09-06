import { expect, test, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";
import {
  createE2EBoard,
  createE2EEdge,
  createE2ENode,
  createE2EStory,
} from "./helpers/graph-fixtures";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

function waitForEdgeDelete(page: Page, boardId: string, edgeId: string) {
  return page.waitForResponse((response) =>
    response.request().method() === "DELETE" &&
    new URL(response.url()).pathname ===
      `/api/v1/boards/${boardId}/edges/${edgeId}`,
  );
}

function waitForEdgeRestore(page: Page, boardId: string, edgeId: string) {
  return page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname ===
      `/api/v1/boards/${boardId}/edges/${edgeId}/restore`,
  );
}

test("Graph Editor persists direct Relationship delete Undo and Redo", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Relationship Delete History User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(
      context.request,
      workspaceId,
      "Relationship Delete History Story",
    );
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Relationship Delete History Board",
    );
    const alice = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Alice",
      x: 120,
      y: 180,
    });
    const bob = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Bob",
      x: 420,
      y: 180,
    });
    const edge = await createE2EEdge(context.request, board.id, workspaceId, {
      sourceNodeId: alice.id,
      targetNodeId: bob.id,
      name: "knows",
    });

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const edgeElement = page.locator(`.react-flow__edge[data-id="${edge.id}"]`);
    await expect(edgeElement).toBeVisible();
    await edgeElement.locator(".react-flow__edge-path").click({ force: true });
    await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();
    await expect(
      page.getByText(
        "이 관계를 이 보드에서 삭제합니다. 현재 세션에서 Undo할 수 있습니다.",
      ),
    ).toBeVisible();

    const deletePromise = waitForEdgeDelete(page, board.id, edge.id);
    await page.getByRole("button", { name: "관계 삭제" }).click();
    expect((await deletePromise).status()).toBe(204);
    await expect(edgeElement).toHaveCount(0);
    await expect(page.getByText("저장됨")).toBeVisible();

    const undoPromise = waitForEdgeRestore(page, board.id, edge.id);
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      id: edge.id,
      boardId: board.id,
      version: edge.version,
    });
    await expect(edgeElement).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    const redoPromise = waitForEdgeDelete(page, board.id, edge.id);
    await page.getByRole("button", { name: "Redo" }).click();
    expect((await redoPromise).status()).toBe(204);
    await expect(edgeElement).toHaveCount(0);

    const finalUndoPromise = waitForEdgeRestore(page, board.id, edge.id);
    await page.getByRole("button", { name: "Undo" }).click();
    expect((await finalUndoPromise).status()).toBe(200);
    await expect(edgeElement).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__edge[data-id="${edge.id}"]`),
    ).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({ id: edge.id, boardId: board.id, name: "knows" }),
    );
    expect(snapshot).not.toHaveProperty("boardEdges");
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
