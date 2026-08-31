import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

async function createScopeEdgeStateSetup(context: BrowserContext) {
  const identity = await createE2EIdentity("Scope EdgeState User");
  await context.addCookies(identity.cookies);

  const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
  expect(bootstrapResponse.status()).toBe(200);
  const bootstrap = await bootstrapResponse.json();
  const workspaceId = bootstrap.workspace.id as string;

  const storyResponse = await context.request.post("/api/v1/stories", {
    data: { workspaceId, name: "Scope EdgeState Story" },
  });
  expect(storyResponse.status()).toBe(201);
  const story = await storyResponse.json();

  const scopeResponse = await context.request.post(
    `/api/v1/stories/${story.id}/scopes`,
    {
      data: {
        workspaceId,
        name: "Chapter 10",
        description: "Scoped relationship state",
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

  const sourceNodeId = crypto.randomUUID();
  const targetNodeId = crypto.randomUUID();
  for (const [id, name, x] of [
    [sourceNodeId, "Alice", 120],
    [targetNodeId, "Crown", 420],
  ] as const) {
    const response = await context.request.post(
      `/api/v1/boards/${unscopedBoard.id}/nodes`,
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

    const placedResponse = await context.request.put(
      `/api/v1/boards/${scopedBoard.id}/nodes/${id}/presentation`,
      {
        data: {
          workspaceId,
          x,
          y: 180,
          width: null,
          height: null,
          zIndex: 0,
          style: {},
        },
      },
    );
    expect(placedResponse.status()).toBe(200);
  }

  const edgeId = crypto.randomUUID();
  const edgeResponse = await context.request.post(
    `/api/v1/boards/${unscopedBoard.id}/edges`,
    {
      data: {
        workspaceId,
        id: edgeId,
        sourceNodeId,
        targetNodeId,
        name: "serves",
      },
    },
  );
  expect(edgeResponse.status()).toBe(201);

  const placedEdgeResponse = await context.request.put(
    `/api/v1/boards/${scopedBoard.id}/edges/${edgeId}`,
    {
      data: {
        workspaceId,
        style: {},
        labelPresentation: {},
      },
    },
  );
  expect(placedEdgeResponse.status()).toBe(200);

  return {
    identity,
    workspaceId,
    story,
    scope,
    unscopedBoard,
    scopedBoard,
    edgeId,
  };
}

function waitForEdgeStatePut(page: Page, scopeId: string, edgeId: string) {
  return page.waitForResponse((response) => {
    return (
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname ===
        `/api/v1/scopes/${scopeId}/edges/${edgeId}/state`
    );
  });
}

test("one canonical Edge resolves differently on scoped and unscoped Boards", async ({
  context,
  page,
}) => {
  const setup = await createScopeEdgeStateSetup(context);

  try {
    await page.goto(
      `/stories/${setup.story.id}/boards/${setup.scopedBoard.id}`,
    );
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(page.getByText("컨텍스트 · Chapter 10")).toBeVisible();

    let scopedEdge = page.locator(
      `.react-flow__edge[data-id="${setup.edgeId}"]`,
    );
    await expect(scopedEdge).toBeVisible();
    await expect(page.getByText("serves", { exact: true })).toBeVisible();
    await scopedEdge.locator(".react-flow__edge-path").click({ force: true });
    await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();
    await expect(page.getByLabel("이름")).toHaveValue("serves");

    const forwardPromise = waitForEdgeStatePut(
      page,
      setup.scope.id,
      setup.edgeId,
    );
    await page.getByLabel("이름").fill("rules");
    const forward = await forwardPromise;
    expect(forward.status()).toBe(200);
    expect(await forward.json()).toMatchObject({
      scopeId: setup.scope.id,
      edgeId: setup.edgeId,
      name: "rules",
      description: null,
      properties: null,
      version: 1,
    });
    await expect(page.getByText("저장됨")).toBeVisible();
    await expect(page.getByText("rules", { exact: true })).toBeVisible();

    const undoPromise = waitForEdgeStatePut(
      page,
      setup.scope.id,
      setup.edgeId,
    );
    await page.getByRole("button", { name: "Undo" }).click();
    const undo = await undoPromise;
    expect(undo.status()).toBe(200);
    expect(await undo.json()).toMatchObject({
      scopeId: setup.scope.id,
      edgeId: setup.edgeId,
      name: null,
      description: null,
      properties: null,
      version: 2,
    });
    await expect(page.getByLabel("이름")).toHaveValue("serves");
    await expect(page.getByText("serves", { exact: true })).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    const redoPromise = waitForEdgeStatePut(
      page,
      setup.scope.id,
      setup.edgeId,
    );
    await page.getByRole("button", { name: "Redo" }).click();
    const redo = await redoPromise;
    expect(redo.status()).toBe(200);
    expect(await redo.json()).toMatchObject({
      scopeId: setup.scope.id,
      edgeId: setup.edgeId,
      name: "rules",
      description: null,
      properties: null,
      version: 3,
    });
    await expect(page.getByLabel("이름")).toHaveValue("rules");
    await expect(page.getByText("rules", { exact: true })).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    scopedEdge = page.locator(`.react-flow__edge[data-id="${setup.edgeId}"]`);
    await expect(scopedEdge).toBeVisible();
    await expect(page.getByText("rules", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();

    const scopedSnapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.scopedBoard.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(scopedSnapshotResponse.status()).toBe(200);
    const scopedSnapshot = await scopedSnapshotResponse.json();
    expect(scopedSnapshot.edges).toContainEqual(
      expect.objectContaining({ id: setup.edgeId, name: "serves" }),
    );
    expect(scopedSnapshot.edgeStates).toContainEqual(
      expect.objectContaining({
        scopeId: setup.scope.id,
        edgeId: setup.edgeId,
        name: "rules",
        description: null,
        properties: null,
        version: 3,
      }),
    );

    await page.goto(
      `/stories/${setup.story.id}/boards/${setup.unscopedBoard.id}`,
    );
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    const canonicalEdge = page.locator(
      `.react-flow__edge[data-id="${setup.edgeId}"]`,
    );
    await expect(canonicalEdge).toBeVisible();
    await expect(page.getByText("serves", { exact: true })).toBeVisible();
    await expect(page.getByText("rules", { exact: true })).toHaveCount(0);

    const canonicalSnapshotResponse = await context.request.get(
      `/api/v1/boards/${setup.unscopedBoard.id}/snapshot?workspaceId=${setup.workspaceId}`,
    );
    expect(canonicalSnapshotResponse.status()).toBe(200);
    const canonicalSnapshot = await canonicalSnapshotResponse.json();
    expect(canonicalSnapshot.edges).toContainEqual(
      expect.objectContaining({ id: setup.edgeId, name: "serves" }),
    );
    expect(canonicalSnapshot.edgeStates).toEqual([]);
  } finally {
    await cleanupE2EIdentity(setup.identity);
  }
});
