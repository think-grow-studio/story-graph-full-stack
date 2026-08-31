import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

async function createScopeNodeStateSetup(context: BrowserContext) {
  const identity = await createE2EIdentity("Scope NodeState User");
  await context.addCookies(identity.cookies);

  const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
  expect(bootstrapResponse.status()).toBe(200);
  const bootstrap = await bootstrapResponse.json();
  const workspaceId = bootstrap.workspace.id as string;

  const storyResponse = await context.request.post("/api/v1/stories", {
    data: { workspaceId, name: "Scope NodeState Story" },
  });
  expect(storyResponse.status()).toBe(201);
  const story = await storyResponse.json();

  const scopeResponse = await context.request.post(
    `/api/v1/stories/${story.id}/scopes`,
    {
      data: {
        workspaceId,
        name: "Chapter 10",
        description: "Scoped chapter state",
      },
    },
  );
  expect(scopeResponse.status()).toBe(201);
  const scope = await scopeResponse.json();

  const unscopedBoardResponse = await context.request.post(
    `/api/v1/stories/${story.id}/boards`,
    { data: { workspaceId, name: "Canonical Board", scopeId: null } },
  );
  expect(unscopedBoardResponse.status()).toBe(201);
  const unscopedBoard = await unscopedBoardResponse.json();

  const scopedBoardResponse = await context.request.post(
    `/api/v1/stories/${story.id}/boards`,
    { data: { workspaceId, name: "Chapter Board", scopeId: scope.id } },
  );
  expect(scopedBoardResponse.status()).toBe(201);
  const scopedBoard = await scopedBoardResponse.json();

  const nodeId = crypto.randomUUID();
  const nodeResponse = await context.request.post(
    `/api/v1/boards/${unscopedBoard.id}/nodes`,
    {
      data: {
        workspaceId,
        id: nodeId,
        name: "Alice",
        description: "Protagonist",
        properties: { role: "lead" },
        position: { x: 120, y: 180 },
      },
    },
  );
  expect(nodeResponse.status()).toBe(201);

  return {
    identity,
    workspaceId,
    story,
    scope,
    unscopedBoard,
    scopedBoard,
    nodeId,
  };
}

function waitForNodeStatePut(page: Page, scopeId: string, nodeId: string) {
  return page.waitForResponse((response) => {
    return (
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname ===
        `/api/v1/scopes/${scopeId}/nodes/${nodeId}/state`
    );
  });
}

test("one canonical Node resolves differently on scoped and unscoped Boards", async ({
  context,
  page,
}) => {
  const setup = await createScopeNodeStateSetup(context);

  try {
    await page.goto(
      `/stories/${setup.story.id}/boards/${setup.scopedBoard.id}`,
    );
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(page.getByText("컨텍스트 · Chapter 10")).toBeVisible();

    await page.getByRole("button", { name: "노드 추가" }).click();
    await page.getByLabel("기존 노드").selectOption({ label: "Alice" });
    const placePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname ===
          `/api/v1/boards/${setup.scopedBoard.id}/nodes/${setup.nodeId}/presentation`
      );
    });
    await page.getByRole("button", { name: "보드에 추가" }).click();
    const placed = await placePromise;
    expect(placed.status()).toBe(200);

    const scopedNode = page.locator(
      `.react-flow__node[data-id="${setup.nodeId}"]`,
    );
    await expect(scopedNode).toContainText("Alice");
    await scopedNode.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();
    await expect(page.getByLabel("이름")).toHaveValue("Alice");

    const forwardPromise = waitForNodeStatePut(
      page,
      setup.scope.id,
      setup.nodeId,
    );
    await page.getByLabel("이름").fill("Queen Alice");
    const forward = await forwardPromise;
    expect(forward.status()).toBe(200);
    expect(await forward.json()).toMatchObject({
      scopeId: setup.scope.id,
      nodeId: setup.nodeId,
      name: "Queen Alice",
      description: null,
      properties: null,
      version: 1,
    });
    await expect(page.getByText("저장됨")).toBeVisible();
    await expect(scopedNode).toContainText("Queen Alice");

    const undoPromise = waitForNodeStatePut(
      page,
      setup.scope.id,
      setup.nodeId,
    );
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      scopeId: setup.scope.id,
      nodeId: setup.nodeId,
      name: null,
      description: null,
      properties: null,
      version: 2,
    });
    await expect(page.getByLabel("이름")).toHaveValue("Alice");
    await expect(scopedNode).toContainText("Alice");
    await expect(page.getByText("저장됨")).toBeVisible();

    const redoPromise = waitForNodeStatePut(
      page,
      setup.scope.id,
      setup.nodeId,
    );
    await page.getByRole("button", { name: "Redo" }).click();
    const redo = await redoPromise;
    expect(redo.status()).toBe(200);
    expect(await redo.json()).toMatchObject({
      scopeId: setup.scope.id,
      nodeId: setup.nodeId,
      name: "Queen Alice",
      description: null,
      properties: null,
      version: 3,
    });
    await expect(page.getByLabel("이름")).toHaveValue("Queen Alice");
    await expect(scopedNode).toContainText("Queen Alice");
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__node[data-id="${setup.nodeId}"]`),
    ).toContainText("Queen Alice");
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();

    const scopedSnapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.scopedBoard.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(scopedSnapshotResponse.status()).toBe(200);
    const scopedSnapshot = await scopedSnapshotResponse.json();
    expect(scopedSnapshot.scope).toMatchObject({
      id: setup.scope.id,
      name: "Chapter 10",
    });
    expect(scopedSnapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: setup.nodeId,
        name: "Alice",
        description: "Protagonist",
        properties: { role: "lead" },
        version: 1,
      }),
    );
    expect(scopedSnapshot.nodeStates).toContainEqual(
      expect.objectContaining({
        scopeId: setup.scope.id,
        nodeId: setup.nodeId,
        name: "Queen Alice",
        description: null,
        properties: null,
        version: 3,
      }),
    );

    await page.goto(
      `/stories/${setup.story.id}/boards/${setup.unscopedBoard.id}`,
    );
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__node[data-id="${setup.nodeId}"]`),
    ).toContainText("Alice");

    const canonicalSnapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.unscopedBoard.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(canonicalSnapshotResponse.status()).toBe(200);
    const canonicalSnapshot = await canonicalSnapshotResponse.json();
    expect(canonicalSnapshot.scope).toBeNull();
    expect(canonicalSnapshot.nodeStates).toEqual([]);
    expect(canonicalSnapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: setup.nodeId,
        name: "Alice",
        description: "Protagonist",
        properties: { role: "lead" },
        version: 1,
      }),
    );
  } finally {
    await cleanupE2EIdentity(setup.identity);
  }
});
