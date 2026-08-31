import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

async function createStoryBoardAndRelationship(
  context: BrowserContext,
  identityName: string,
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

  const sourceNodeId = crypto.randomUUID();
  const targetNodeId = crypto.randomUUID();
  for (const [id, name, x] of [
    [sourceNodeId, "Alice", 120],
    [targetNodeId, "Bob", 420],
  ] as const) {
    const response = await context.request.post(
      `/api/v1/boards/${board.id}/nodes`,
      {
        data: {
          workspaceId,
          id,
          name,
          position: { x, y: 180 },
        },
      },
    );
    expect(response.status()).toBe(201);
  }

  const edgeId = crypto.randomUUID();
  const edgeResponse = await context.request.post(
    `/api/v1/boards/${board.id}/edges`,
    {
      data: {
        workspaceId,
        id: edgeId,
        sourceNodeId,
        targetNodeId,
        name: "knows",
      },
    },
  );
  expect(edgeResponse.status()).toBe(201);

  return {
    identity,
    workspaceId,
    story,
    board,
    edgeId,
  };
}

function waitForBoardEdgeRequest(
  page: Page,
  method: "DELETE" | "PUT",
  boardId: string,
  edgeId: string,
) {
  return page.waitForResponse((response) => {
    return (
      response.request().method() === method &&
      new URL(response.url()).pathname ===
        `/api/v1/boards/${boardId}/edges/${edgeId}`
    );
  });
}

test("Graph Editor persists Relationship Board removal Undo and Redo across reload", async ({
  context,
  page,
}) => {
  const setup = await createStoryBoardAndRelationship(
    context,
    "Relationship Board Removal History User",
  );

  try {
    await page.goto(`/stories/${setup.story.id}/boards/${setup.board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const edge = page.locator(`.react-flow__edge[data-id="${setup.edgeId}"]`);
    await expect(edge).toBeVisible();
    await edge.locator(".react-flow__edge-path").click({ force: true });
    await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();

    const removePromise = waitForBoardEdgeRequest(
      page,
      "DELETE",
      setup.board.id,
      setup.edgeId,
    );
    await page.getByRole("button", { name: "보드에서 제거" }).click();
    expect((await removePromise).status()).toBe(204);
    await expect(edge).toHaveCount(0);
    await expect(page.getByText("저장됨")).toBeVisible();

    const undoPromise = waitForBoardEdgeRequest(
      page,
      "PUT",
      setup.board.id,
      setup.edgeId,
    );
    await page.getByRole("button", { name: "Undo" }).click();
    expect((await undoPromise).status()).toBe(200);
    await expect(edge).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    const redoPromise = waitForBoardEdgeRequest(
      page,
      "DELETE",
      setup.board.id,
      setup.edgeId,
    );
    await page.getByRole("button", { name: "Redo" }).click();
    expect((await redoPromise).status()).toBe(204);
    await expect(edge).toHaveCount(0);
    await expect(page.getByText("저장됨")).toBeVisible();

    const finalUndoPromise = waitForBoardEdgeRequest(
      page,
      "PUT",
      setup.board.id,
      setup.edgeId,
    );
    await page.getByRole("button", { name: "Undo" }).click();
    expect((await finalUndoPromise).status()).toBe(200);
    await expect(edge).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__edge[data-id="${setup.edgeId}"]`),
    ).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.board.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({ id: setup.edgeId, name: "knows" }),
    );
    expect(snapshot.boardEdges).toContainEqual(
      expect.objectContaining({ boardId: setup.board.id, edgeId: setup.edgeId }),
    );
  } finally {
    await cleanupE2EIdentity(setup.identity);
  }
});
