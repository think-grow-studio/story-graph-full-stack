import { expect, test, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

function waitForPath(page: Page, method: string, pathname: string) {
  return page.waitForResponse((response) => {
    return (
      response.request().method() === method &&
      new URL(response.url()).pathname === pathname
    );
  });
}

test("author can create a Story, Board, Nodes and Relationship from visible product UI", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Product UI Author");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "내 이야기" })).toBeVisible();

    await page.getByRole("button", { name: "새 이야기" }).click();
    await expect(page.getByRole("dialog", { name: "새 이야기" })).toBeVisible();
    await page.getByLabel("이야기 이름").fill("UI Acceptance Story");
    await page.getByLabel("설명").fill("Product UI acceptance world");
    await page.getByRole("button", { name: "이야기 만들기" }).click();
    await expect(page).toHaveURL(/\/stories\/[0-9a-f-]+$/i);
    const storyId = page.url().split("/").at(-1)!;
    await expect(page.getByRole("heading", { name: "UI Acceptance Story" })).toBeVisible();

    await page.getByRole("button", { name: "새 보드" }).click();
    await expect(page.getByRole("dialog", { name: "새 보드" })).toBeVisible();
    await page.getByLabel("보드 이름").fill("Main Board");
    await page.getByRole("button", { name: "보드 만들기" }).click();
    await expect(page).toHaveURL(
      /\/stories\/[0-9a-f-]+\/boards\/[0-9a-f-]+$/i,
    );
    const boardId = page.url().split("/").at(-1)!;
    await expect(page.getByRole("heading", { name: "Main Board" })).toBeVisible();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.getByRole("button", { name: "노드 추가" }).click();
    await page.getByLabel("노드 이름").fill("Alice");
    const createAlicePromise = waitForPath(
      page,
      "POST",
      `/api/v1/boards/${boardId}/nodes`,
    );
    await page.getByRole("button", { name: "새 노드 만들기" }).click();
    const createAlice = await createAlicePromise;
    expect(createAlice.status()).toBe(201);
    const aliceCreated = await createAlice.json();
    const aliceId = aliceCreated.node.id as string;
    const alice = page.locator(`.react-flow__node[data-id="${aliceId}"]`);
    await expect(alice).toContainText("Alice");
    await expect(page.getByText("저장됨")).toBeVisible();

    const aliceBox = await alice.boundingBox();
    expect(aliceBox).not.toBeNull();
    const moveAlicePromise = waitForPath(
      page,
      "PATCH",
      `/api/v1/boards/${boardId}/nodes/${aliceId}`,
    );
    await page.mouse.move(
      aliceBox!.x + aliceBox!.width / 2,
      aliceBox!.y + aliceBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      aliceBox!.x + aliceBox!.width / 2 - 220,
      aliceBox!.y + aliceBox!.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    expect((await moveAlicePromise).status()).toBe(200);
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.getByRole("button", { name: "노드 추가" }).click();
    await page.getByLabel("노드 이름").fill("Bob");
    const createBobPromise = waitForPath(
      page,
      "POST",
      `/api/v1/boards/${boardId}/nodes`,
    );
    await page.getByRole("button", { name: "새 노드 만들기" }).click();
    const createBob = await createBobPromise;
    expect(createBob.status()).toBe(201);
    const bobCreated = await createBob.json();
    const bobId = bobCreated.node.id as string;
    const bob = page.locator(`.react-flow__node[data-id="${bobId}"]`);
    await expect(bob).toContainText("Bob");
    await expect(page.getByText("저장됨")).toBeVisible();

    const sourceHandle = alice.locator(".react-flow__handle.source");
    const targetHandle = bob.locator(".react-flow__handle.target");
    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await targetHandle.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    await page.mouse.move(
      sourceBox!.x + sourceBox!.width / 2,
      sourceBox!.y + sourceBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + targetBox!.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();

    await expect(page.getByRole("dialog", { name: "관계 만들기" })).toBeVisible();
    await expect(page.getByText("Alice → Bob")).toBeVisible();
    await page.getByLabel("관계 이름").fill("knows");
    const createEdgePromise = waitForPath(
      page,
      "POST",
      `/api/v1/boards/${boardId}/edges`,
    );
    await page.getByRole("button", { name: "관계 만들기" }).click();
    const createEdge = await createEdgePromise;
    expect(createEdge.status()).toBe(201);
    const edgeCreated = await createEdge.json();
    const edgeId = edgeCreated.edge.id as string;
    const edge = page.locator(`.react-flow__edge[data-id="${edgeId}"]`);
    await expect(edge).toBeVisible();
    await expect(page.getByText("knows", { exact: true })).toBeVisible();
    await expect(page.getByText("저장됨")).toBeVisible();

    await alice.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();
    const updateAlicePromise = waitForPath(page, "PATCH", `/api/v1/nodes/${aliceId}`);
    await page.getByLabel("이름").fill("Alicia");
    await page.getByLabel("설명").fill("Main protagonist");
    const updateAlice = await updateAlicePromise;
    expect(updateAlice.status()).toBe(200);
    await expect(page.getByText("저장됨")).toBeVisible();
    await expect(alice).toContainText("Alicia");

    await edge.locator(".react-flow__edge-path").click({ force: true });
    await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();
    const updateEdgePromise = waitForPath(page, "PATCH", `/api/v1/edges/${edgeId}`);
    await page.getByLabel("이름").fill("protects");
    await page.getByLabel("설명").fill("Keeps Bob safe");
    const updateEdge = await updateEdgePromise;
    expect(updateEdge.status()).toBe(200);
    await expect(page.getByText("저장됨")).toBeVisible();
    await expect(page.getByText("protects", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(
      page.locator(`.react-flow__node[data-id="${aliceId}"]`),
    ).toContainText("Alicia");
    await expect(
      page.locator(`.react-flow__node[data-id="${bobId}"]`),
    ).toContainText("Bob");
    await expect(
      page.locator(`.react-flow__edge[data-id="${edgeId}"]`),
    ).toBeVisible();
    await expect(page.getByText("protects", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${boardId}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.story).toMatchObject({ id: storyId, name: "UI Acceptance Story" });
    expect(snapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: aliceId,
        name: "Alicia",
        description: "Main protagonist",
      }),
    );
    expect(snapshot.nodes).toContainEqual(
      expect.objectContaining({ id: bobId, name: "Bob" }),
    );
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        id: edgeId,
        sourceNodeId: aliceId,
        targetNodeId: bobId,
        name: "protects",
        description: "Keeps Bob safe",
      }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
