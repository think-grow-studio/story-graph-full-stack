import { expect, test } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

test("Google is the only authentication entry", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "다시 만나서 반가워요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "이야기를 연결해 보세요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
});

test("authenticated users cannot manage the hidden Workspace through Better Auth", async ({
  context,
}) => {
  const identity = await createE2EIdentity("Workspace Boundary User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const sameOriginHeaders = { origin: "http://localhost:3000" };

    const createResponse = await context.request.post(
      "/api/auth/organization/create",
      {
        headers: sameOriginHeaders,
        data: {
          name: "Rogue Workspace",
          slug: `rogue-${crypto.randomUUID()}`,
        },
      },
    );

    const updateResponse = await context.request.post(
      "/api/auth/organization/update",
      {
        headers: sameOriginHeaders,
        data: {
          organizationId: bootstrap.workspace.id,
          data: {
            slug: `tampered-${crypto.randomUUID()}`,
          },
        },
      },
    );

    const deleteResponse = await context.request.post(
      "/api/auth/organization/delete",
      {
        headers: sameOriginHeaders,
        data: {
          organizationId: bootstrap.workspace.id,
        },
      },
    );

    expect([
      createResponse.status(),
      updateResponse.status(),
      deleteResponse.status(),
    ]).toEqual([403, 403, 403]);
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("authenticated user creates a Story that survives reload", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("E2E Google User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    const bootstrapBody = await bootstrapResponse.text();
    expect(bootstrapResponse.status(), bootstrapBody).toBe(200);
    expect(JSON.parse(bootstrapBody).workspace.name).toBe(
      "E2E Google User's Workspace",
    );

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "내 이야기" })).toBeVisible();

    await page.getByRole("button", { name: "새 이야기" }).click();
    await page.getByLabel("이야기 이름").fill("My First Story");
    await page.getByRole("button", { name: "이야기 만들기" }).click();
    await expect(page).toHaveURL(/\/stories\/[0-9a-f-]+$/i);
    await expect(page.getByRole("heading", { name: "My First Story" })).toBeVisible();

    await page.goto("/dashboard");
    await page.reload();
    await expect(page.getByRole("link", { name: "My First Story" })).toBeVisible();
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph Core snapshot survives a page reload", async ({ context, page }) => {
  const identity = await createE2EIdentity("Graph Persistence User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    const storyResponse = await context.request.post("/api/v1/stories", {
      data: { workspaceId, name: "Persistent Graph Story" },
    });
    expect(storyResponse.status()).toBe(201);
    const story = await storyResponse.json();

    const boardResponse = await context.request.post(
      `/api/v1/stories/${story.id}/boards`,
      { data: { workspaceId, name: "Main Board" } },
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
          name: "Persistent Node",
          position: { x: 120, y: 80 },
        },
      },
    );
    expect(nodeResponse.status()).toBe(201);

    const firstSnapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(firstSnapshotResponse.status()).toBe(200);
    const firstSnapshot = await firstSnapshotResponse.json();
    expect(firstSnapshot.nodes).toEqual([
      expect.objectContaining({ id: nodeId, version: 1, name: "Persistent Node" }),
    ]);
    expect(firstSnapshot.boardNodes).toEqual([
      expect.objectContaining({ nodeId, x: 120, y: 80 }),
    ]);

    await page.goto("/dashboard");
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);

    const secondSnapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(secondSnapshotResponse.status()).toBe(200);
    const secondSnapshot = await secondSnapshotResponse.json();
    expect(secondSnapshot.nodes).toEqual([
      expect.objectContaining({ id: nodeId, version: 1, name: "Persistent Node" }),
    ]);
    expect(secondSnapshot.boardNodes).toEqual([
      expect.objectContaining({ nodeId, x: 120, y: 80 }),
    ]);
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph Editor creates and repositions a Node through the UI", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph Editor User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "새 이야기" }).click();
    await page.getByLabel("이야기 이름").fill("Editor E2E Story");
    await page.getByRole("button", { name: "이야기 만들기" }).click();
    await expect(page).toHaveURL(/\/stories\/[0-9a-f-]+$/i);

    await page.getByRole("button", { name: "새 보드" }).click();
    await page.getByLabel("보드 이름").fill("Characters");
    await page.getByRole("button", { name: "보드 만들기" }).click();
    await expect(page).toHaveURL(
      /\/stories\/[0-9a-f-]+\/boards\/[0-9a-f-]+$/i,
    );

    const boardId = page.url().split("/").at(-1)!;
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    await page.getByRole("button", { name: "노드 추가" }).click();
    await page.getByLabel("노드 이름").fill("E2E Node");

    const createResponsePromise = page.waitForResponse((response) => {
      const path = new URL(response.url()).pathname;
      return (
        response.request().method() === "POST" &&
        path === `/api/v1/boards/${boardId}/nodes`
      );
    });
    await page.getByRole("button", { name: "새 노드 만들기" }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const node = page.locator(".react-flow__node").filter({ hasText: "E2E Node" });
    await expect(node).toBeVisible();

    const nodeId = await node.getAttribute("data-id");
    expect(nodeId).toBeTruthy();

    const initialSnapshotResponse = await context.request.get(
      `/api/v1/boards/${boardId}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(initialSnapshotResponse.status()).toBe(200);
    const initialSnapshot = await initialSnapshotResponse.json();
    const initialPlacement = initialSnapshot.boardNodes.find(
      (boardNode: { nodeId: string }) => boardNode.nodeId === nodeId,
    );
    expect(initialPlacement).toBeTruthy();

    const box = await node.boundingBox();
    expect(box).not.toBeNull();

    const placementResponsePromise = page.waitForResponse((response) => {
      const path = new URL(response.url()).pathname;
      return (
        response.request().method() === "PATCH" &&
        path === `/api/v1/boards/${boardId}/nodes/${nodeId}`
      );
    });

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 120,
      box!.y + box!.height / 2 + 90,
      { steps: 8 },
    );
    await page.mouse.up();

    const placementResponse = await placementResponsePromise;
    expect(placementResponse.status()).toBe(200);
    const persistedPlacement = await placementResponse.json();
    expect(persistedPlacement.nodeId).toBe(nodeId);
    expect({ x: persistedPlacement.x, y: persistedPlacement.y }).not.toEqual({
      x: initialPlacement.x,
      y: initialPlacement.y,
    });

    await page.reload();
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "E2E Node" }),
    ).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${boardId}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const editorSnapshot = await snapshotResponse.json();
    expect(editorSnapshot.boardNodes).toContainEqual(
      expect.objectContaining({
        nodeId,
        x: persistedPlacement.x,
        y: persistedPlacement.y,
      }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
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

    await expect(page.getByLabel("관계 이름")).toBeVisible();
    await page.getByLabel("관계 이름").fill("sister");

    const createResponsePromise = page.waitForResponse((response) => {
      const path = new URL(response.url()).pathname;
      return (
        response.request().method() === "POST" &&
        path === `/api/v1/boards/${board.id}/edges`
      );
    });
    await page.getByRole("button", { name: "관계 만들기" }).click();

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

test("Graph Editor edits canonical Node and Relationship data through the Inspector", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph Inspector User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    const storyResponse = await context.request.post("/api/v1/stories", {
      data: { workspaceId, name: "Inspector Story" },
    });
    expect(storyResponse.status()).toBe(201);
    const story = await storyResponse.json();

    const boardResponse = await context.request.post(
      `/api/v1/stories/${story.id}/boards`,
      { data: { workspaceId, name: "Inspector Board" } },
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

    const edgeId = crypto.randomUUID();
    const edgeResponse = await context.request.post(
      `/api/v1/boards/${board.id}/edges`,
      {
        data: {
          workspaceId,
          id: edgeId,
          sourceNodeId: aliceId,
          targetNodeId: bobId,
          name: "knows",
          description: "",
          iconKey: null,
          properties: {},
        },
      },
    );
    expect(edgeResponse.status()).toBe(201);

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const alice = page.locator(`.react-flow__node[data-id="${aliceId}"]`);
    await alice.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();
    await page.getByLabel("이름").fill("Alicia");
    await page.getByLabel("설명").fill("Main protagonist");
    const nodeUpdatePromise = page.waitForResponse((response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/v1/nodes/${aliceId}`,
    );
    await page.getByLabel("속성 JSON").fill('{"role":"lead","age":31}');
    await expect(page.getByText("저장되지 않음")).toBeVisible();

    const nodeUpdate = await nodeUpdatePromise;
    expect(nodeUpdate.status()).toBe(200);
    expect(await nodeUpdate.json()).toMatchObject({
      id: aliceId,
      name: "Alicia",
      description: "Main protagonist",
      properties: { role: "lead", age: 31 },
      version: 2,
    });
    await expect(page.getByText("저장됨")).toBeVisible();
    await expect(page.locator(`.react-flow__node[data-id="${aliceId}"]`)).toContainText("Alicia");

    const relationship = page.locator(".react-flow__edge").filter({ hasText: "knows" });
    await relationship.click();
    await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();
    await page.getByLabel("이름").fill("best friend");
    await page.getByLabel("설명").fill("Childhood friends");
    const edgeUpdatePromise = page.waitForResponse((response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/v1/edges/${edgeId}`,
    );
    await page.getByLabel("속성 JSON").fill('{"since":2012}');
    await expect(page.getByText("저장되지 않음")).toBeVisible();

    const edgeUpdate = await edgeUpdatePromise;
    expect(edgeUpdate.status()).toBe(200);
    expect(await edgeUpdate.json()).toMatchObject({
      id: edgeId,
      name: "best friend",
      description: "Childhood friends",
      properties: { since: 2012 },
      version: 2,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(page.locator(`.react-flow__node[data-id="${aliceId}"]`)).toContainText("Alicia");
    await expect(
      page.locator(".react-flow__edge").filter({ hasText: "best friend" }),
    ).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const persisted = await snapshotResponse.json();
    expect(persisted.nodes).toContainEqual(
      expect.objectContaining({
        id: aliceId,
        name: "Alicia",
        description: "Main protagonist",
        properties: { role: "lead", age: 31 },
        version: 2,
      }),
    );
    expect(persisted.edges).toContainEqual(
      expect.objectContaining({
        id: edgeId,
        name: "best friend",
        description: "Childhood friends",
        properties: { since: 2012 },
        version: 2,
      }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph Editor removes a Node from the Board without deleting canonical graph data", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph Board Removal User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    const storyResponse = await context.request.post("/api/v1/stories", {
      data: { workspaceId, name: "Board Removal Story" },
    });
    expect(storyResponse.status()).toBe(201);
    const story = await storyResponse.json();

    const boardResponse = await context.request.post(
      `/api/v1/stories/${story.id}/boards`,
      { data: { workspaceId, name: "Removal Board" } },
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

    const edgeId = crypto.randomUUID();
    const edgeResponse = await context.request.post(
      `/api/v1/boards/${board.id}/edges`,
      {
        data: {
          workspaceId,
          id: edgeId,
          sourceNodeId: aliceId,
          targetNodeId: bobId,
          name: "knows",
          description: "",
          iconKey: null,
          properties: {},
        },
      },
    );
    expect(edgeResponse.status()).toBe(201);

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    const alice = page.locator(`.react-flow__node[data-id="${aliceId}"]`);
    const bob = page.locator(`.react-flow__node[data-id="${bobId}"]`);
    const relationship = page.locator(".react-flow__edge").filter({ hasText: "knows" });
    await expect(alice).toBeVisible();
    await expect(bob).toBeVisible();
    await expect(relationship).toBeVisible();

    await alice.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();

    const removeResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname ===
        `/api/v1/boards/${board.id}/nodes/${aliceId}`,
    );
    await page.getByRole("button", { name: "보드에서 제거" }).click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.status()).toBe(204);

    await expect(alice).toHaveCount(0);
    await expect(relationship).toHaveCount(0);
    await expect(bob).toBeVisible();

    await page.reload();
    await expect(page.locator(`.react-flow__node[data-id="${aliceId}"]`)).toHaveCount(0);
    await expect(page.locator(`.react-flow__node[data-id="${bobId}"]`)).toBeVisible();
    await expect(
      page.locator(".react-flow__edge").filter({ hasText: "knows" }),
    ).toHaveCount(0);

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.board.revision).toBe(4);
    expect(snapshot.nodes.map((node: { id: string }) => node.id)).toEqual([bobId]);
    expect(snapshot.boardNodes.map((node: { nodeId: string }) => node.nodeId)).toEqual([
      bobId,
    ]);
    expect(snapshot.edges).toEqual([]);
    expect(snapshot.boardEdges).toEqual([]);

    const canonicalNodeUpdate = await context.request.patch(
      `/api/v1/nodes/${aliceId}`,
      {
        data: {
          workspaceId,
          version: 1,
          name: "Alice canonical",
          description: "still in story graph",
          properties: {},
        },
      },
    );
    expect(canonicalNodeUpdate.status()).toBe(200);
    expect(await canonicalNodeUpdate.json()).toMatchObject({
      id: aliceId,
      name: "Alice canonical",
      version: 2,
    });

    const canonicalEdgeUpdate = await context.request.patch(
      `/api/v1/edges/${edgeId}`,
      {
        data: {
          workspaceId,
          version: 1,
          name: "knows canonically",
          description: "still in story graph",
          properties: {},
        },
      },
    );
    expect(canonicalEdgeUpdate.status()).toBe(200);
    expect(await canonicalEdgeUpdate.json()).toMatchObject({
      id: edgeId,
      name: "knows canonically",
      version: 2,
    });
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
