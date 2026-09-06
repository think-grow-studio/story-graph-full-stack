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

function waitForNodeDelete(page: Page, boardId: string, nodeId: string) {
  return page.waitForResponse((response) =>
    response.request().method() === "DELETE" &&
    new URL(response.url()).pathname ===
      `/api/v1/boards/${boardId}/nodes/${nodeId}`,
  );
}

function waitForNodeRestore(page: Page, boardId: string, nodeId: string) {
  return page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname ===
      `/api/v1/boards/${boardId}/nodes/${nodeId}/restore`,
  );
}

test("Graph Editor persists direct Node delete Undo and Redo with incident Relationship", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Node Delete History User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(
      context.request,
      workspaceId,
      "Node Delete History Story",
    );
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Node Delete History Board",
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

    const aliceElement = page.locator(`.react-flow__node[data-id="${alice.id}"]`);
    const bobElement = page.locator(`.react-flow__node[data-id="${bob.id}"]`);
    const edgeElement = page.locator(`.react-flow__edge[data-id="${edge.id}"]`);
    await expect(aliceElement).toContainText("Alice");
    await expect(bobElement).toContainText("Bob");
    await expect(edgeElement).toBeVisible();

    await aliceElement.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();
    await expect(
      page.getByText(
        "이 노드를 삭제하면 이 보드의 연결된 관계도 함께 삭제됩니다. 현재 세션에서 Undo할 수 있습니다.",
      ),
    ).toBeVisible();

    const deletePromise = waitForNodeDelete(page, board.id, alice.id);
    await page.getByRole("button", { name: "노드 삭제" }).click();
    expect((await deletePromise).status()).toBe(204);
    await expect(aliceElement).toHaveCount(0);
    await expect(edgeElement).toHaveCount(0);
    await expect(bobElement).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    const undoPromise = waitForNodeRestore(page, board.id, alice.id);
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      node: { id: alice.id, boardId: board.id, version: alice.version },
      edges: [expect.objectContaining({ id: edge.id, version: edge.version })],
    });
    await expect(aliceElement).toBeVisible();
    await expect(edgeElement).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    const redoPromise = waitForNodeDelete(page, board.id, alice.id);
    await page.getByRole("button", { name: "Redo" }).click();
    expect((await redoPromise).status()).toBe(204);
    await expect(aliceElement).toHaveCount(0);
    await expect(edgeElement).toHaveCount(0);
    await expect(bobElement).toBeVisible();

    const finalUndoPromise = waitForNodeRestore(page, board.id, alice.id);
    await page.getByRole("button", { name: "Undo" }).click();
    expect((await finalUndoPromise).status()).toBe(200);
    await expect(aliceElement).toBeVisible();
    await expect(edgeElement).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__node[data-id="${alice.id}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`.react-flow__node[data-id="${bob.id}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`.react-flow__edge[data-id="${edge.id}"]`),
    ).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.nodes).toContainEqual(
      expect.objectContaining({ id: alice.id, boardId: board.id, name: "Alice" }),
    );
    expect(snapshot.nodes).toContainEqual(
      expect.objectContaining({ id: bob.id, boardId: board.id, name: "Bob" }),
    );
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({ id: edge.id, boardId: board.id, name: "knows" }),
    );
    expect(snapshot).not.toHaveProperty("boardNodes");
    expect(snapshot).not.toHaveProperty("boardEdges");
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
