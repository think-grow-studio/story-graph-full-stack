import { expect, test } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

test("Graph Editor connects two Nodes and restores the Relationship after reload", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph Edge User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    const storyResponse = await context.request.post("/api/v1/stories", {
      data: { workspaceId, name: "Relationship Story" },
    });
    expect(storyResponse.status()).toBe(201);
    const story = await storyResponse.json();

    const boardResponse = await context.request.post(
      `/api/v1/stories/${story.id}/boards`,
      { data: { workspaceId, name: "Relationships" } },
    );
    expect(boardResponse.status()).toBe(201);
    const board = await boardResponse.json();

    const aliceId = crypto.randomUUID();
    const bobId = crypto.randomUUID();
    for (const node of [
      { id: aliceId, name: "Alice", position: { x: 120, y: 180 } },
      { id: bobId, name: "Bob", position: { x: 520, y: 180 } },
    ]) {
      const response = await context.request.post(
        `/api/v1/boards/${board.id}/nodes`,
        {
          data: {
            workspaceId,
            id: node.id,
            name: node.name,
            position: node.position,
          },
        },
      );
      expect(response.status()).toBe(201);
    }

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const alice = page.locator(`.react-flow__node[data-id="${aliceId}"]`);
    const bob = page.locator(`.react-flow__node[data-id="${bobId}"]`);
    await expect(alice).toContainText("Alice");
    await expect(bob).toContainText("Bob");

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

    await expect(page.getByLabel("Relationship name")).toBeVisible();
    await page.getByLabel("Relationship name").fill("sister");

    const createResponsePromise = page.waitForResponse((response) => {
      const path = new URL(response.url()).pathname;
      return (
        response.request().method() === "POST" &&
        path === `/api/v1/boards/${board.id}/edges`
      );
    });
    await page.getByRole("button", { name: "Create Relationship" }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    expect(created.edge).toMatchObject({
      sourceNodeId: aliceId,
      targetNodeId: bobId,
      name: "sister",
    });
    expect(created.boardEdge.edgeId).toBe(created.edge.id);
    await expect(page.locator(".react-flow__edge").filter({ hasText: "sister" })).toBeVisible();

    await page.reload();
    await expect(page.locator(".react-flow__edge").filter({ hasText: "sister" })).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        id: created.edge.id,
        sourceNodeId: aliceId,
        targetNodeId: bobId,
        name: "sister",
      }),
    );
    expect(snapshot.boardEdges).toContainEqual(
      expect.objectContaining({ edgeId: created.edge.id }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
