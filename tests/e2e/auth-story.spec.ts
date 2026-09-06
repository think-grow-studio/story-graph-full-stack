import { expect, test } from "@playwright/test";

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

test("Board-owned Graph snapshot survives a page reload", async ({ context, page }) => {
  const identity = await createE2EIdentity("Graph Persistence User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(
      context.request,
      workspaceId,
      "Persistent Graph Story",
    );
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Main Board",
      ["persistence"],
    );
    const node = await createE2ENode(
      context.request,
      board.id,
      workspaceId,
      { name: "Persistent Node", x: 120, y: 80 },
    );

    const firstSnapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(firstSnapshotResponse.status()).toBe(200);
    const firstSnapshot = await firstSnapshotResponse.json();
    expect(firstSnapshot.board.tags).toEqual(["persistence"]);
    expect(firstSnapshot.nodes).toEqual([
      expect.objectContaining({
        id: node.id,
        boardId: board.id,
        version: 1,
        name: "Persistent Node",
        x: 120,
        y: 80,
      }),
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
      expect.objectContaining({
        id: node.id,
        boardId: board.id,
        version: 1,
        name: "Persistent Node",
        x: 120,
        y: 80,
      }),
    ]);
    expect(secondSnapshot).not.toHaveProperty("boardNodes");
    expect(secondSnapshot).not.toHaveProperty("boardEdges");
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph Editor creates and repositions a direct Board-owned Node through the UI", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph Editor User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "새 이야기" }).click();
    await page.getByLabel("이야기 이름").fill("Editor E2E Story");
    await page.getByRole("button", { name: "이야기 만들기" }).click();
    await expect(page).toHaveURL(/\/stories\/[0-9a-f-]+$/i);

    await page.getByRole("button", { name: "새 보드" }).click();
    await page.getByLabel("보드 이름").fill("Characters");
    await page.getByLabel("태그").fill("characters, draft");
    await page.getByRole("button", { name: "보드 만들기" }).click();
    await expect(page).toHaveURL(
      /\/stories\/[0-9a-f-]+\/boards\/[0-9a-f-]+$/i,
    );

    const boardId = page.url().split("/").at(-1)!;
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    await page.getByRole("button", { name: "노드 추가" }).click();
    await page.getByLabel("노드 이름").fill("E2E Node");
    const createResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/v1/boards/${boardId}/nodes`,
    );
    await page.getByRole("button", { name: "새 노드 만들기" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const createdNode = await createResponse.json();
    expect(createdNode).toMatchObject({
      boardId,
      name: "E2E Node",
      version: 1,
    });

    const node = page.locator(`.react-flow__node[data-id="${createdNode.id}"]`);
    await expect(node).toContainText("E2E Node");

    const initialSnapshotResponse = await context.request.get(
      `/api/v1/boards/${boardId}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(initialSnapshotResponse.status()).toBe(200);
    const initialSnapshot = await initialSnapshotResponse.json();
    const initialNode = initialSnapshot.nodes.find(
      (candidate: { id: string }) => candidate.id === createdNode.id,
    );
    expect(initialNode).toMatchObject({ id: createdNode.id });

    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    const moveResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname ===
        `/api/v1/boards/${boardId}/nodes/${createdNode.id}`,
    );
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 120,
      box!.y + box!.height / 2 + 90,
      { steps: 8 },
    );
    await page.mouse.up();

    const moveResponse = await moveResponsePromise;
    expect(moveResponse.status()).toBe(200);
    const movedNode = await moveResponse.json();
    expect(movedNode).toMatchObject({
      id: createdNode.id,
      boardId,
      version: 2,
    });
    expect({ x: movedNode.x, y: movedNode.y }).not.toEqual({
      x: initialNode.x,
      y: initialNode.y,
    });

    await page.reload();
    await expect(
      page.locator(`.react-flow__node[data-id="${createdNode.id}"]`),
    ).toContainText("E2E Node");

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${boardId}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const editorSnapshot = await snapshotResponse.json();
    expect(editorSnapshot.nodes).toContainEqual(
      expect.objectContaining({
        id: createdNode.id,
        boardId,
        x: movedNode.x,
        y: movedNode.y,
        version: 2,
      }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph Editor creates a direct Relationship and restores it after reload", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph Edge User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(context.request, workspaceId, "Relationship Story");
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Relationships",
    );
    const alice = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Alice",
      x: 120,
      y: 180,
    });
    const bob = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Bob",
      x: 520,
      y: 180,
    });

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const aliceElement = page.locator(`.react-flow__node[data-id="${alice.id}"]`);
    const bobElement = page.locator(`.react-flow__node[data-id="${bob.id}"]`);
    const sourceHandle = aliceElement.locator(".react-flow__handle.source");
    const targetHandle = bobElement.locator(".react-flow__handle.target");
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

    await page.getByLabel("관계 이름").fill("sister");
    const createResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/v1/boards/${board.id}/edges`,
    );
    await page.getByRole("button", { name: "관계 만들기" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const createdEdge = await createResponse.json();
    expect(createdEdge).toMatchObject({
      boardId: board.id,
      sourceNodeId: alice.id,
      targetNodeId: bob.id,
      name: "sister",
      version: 1,
    });
    await expect(
      page.locator(`.react-flow__edge[data-id="${createdEdge.id}"]`),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.locator(`.react-flow__edge[data-id="${createdEdge.id}"]`),
    ).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        id: createdEdge.id,
        boardId: board.id,
        sourceNodeId: alice.id,
        targetNodeId: bob.id,
        name: "sister",
      }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph Editor edits direct Node and Relationship rows through the Inspector", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph Inspector User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(context.request, workspaceId, "Inspector Story");
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Inspector Board",
    );
    const alice = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Alice",
      x: 120,
      y: 180,
    });
    const bob = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Bob",
      x: 520,
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
    await aliceElement.click();
    await expect(page.getByRole("heading", { name: "노드" })).toBeVisible();
    await page.getByLabel("이름").fill("Alicia");
    await page.getByLabel("설명").fill("Main protagonist");
    const nodeUpdatePromise = page.waitForResponse((response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname ===
        `/api/v1/boards/${board.id}/nodes/${alice.id}`,
    );
    await page.getByLabel("속성 JSON").fill('{"role":"lead","age":31}');
    const nodeUpdate = await nodeUpdatePromise;
    expect(nodeUpdate.status()).toBe(200);
    expect(await nodeUpdate.json()).toMatchObject({
      id: alice.id,
      boardId: board.id,
      name: "Alicia",
      description: "Main protagonist",
      properties: { role: "lead", age: 31 },
      version: 2,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    const edgeElement = page.locator(`.react-flow__edge[data-id="${edge.id}"]`);
    await edgeElement.locator(".react-flow__edge-path").click({ force: true });
    await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();
    await page.getByLabel("이름").fill("best friend");
    await page.getByLabel("설명").fill("Childhood friends");
    const edgeUpdatePromise = page.waitForResponse((response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname ===
        `/api/v1/boards/${board.id}/edges/${edge.id}`,
    );
    await page.getByLabel("속성 JSON").fill('{"since":2012}');
    const edgeUpdate = await edgeUpdatePromise;
    expect(edgeUpdate.status()).toBe(200);
    expect(await edgeUpdate.json()).toMatchObject({
      id: edge.id,
      boardId: board.id,
      name: "best friend",
      description: "Childhood friends",
      properties: { since: 2012 },
      version: 2,
    });
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await expect(
      page.locator(`.react-flow__node[data-id="${alice.id}"]`),
    ).toContainText("Alicia");
    await expect(page.locator(`.react-flow__edge[data-id="${edge.id}"]`)).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const persisted = await snapshotResponse.json();
    expect(persisted.nodes).toContainEqual(
      expect.objectContaining({
        id: alice.id,
        name: "Alicia",
        description: "Main protagonist",
        properties: { role: "lead", age: 31 },
        version: 2,
      }),
    );
    expect(persisted.edges).toContainEqual(
      expect.objectContaining({
        id: edge.id,
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
