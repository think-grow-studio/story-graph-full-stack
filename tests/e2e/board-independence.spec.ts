import { expect, test } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

test("Boards keep same-named Nodes and Relationships independent", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Board Independence User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    const storyResponse = await context.request.post("/api/v1/stories", {
      data: { workspaceId, name: "Independent Boards Story" },
    });
    expect(storyResponse.status()).toBe(201);
    const story = await storyResponse.json();

    const createBoard = async (name: string, tags: string[]) => {
      const response = await context.request.post(
        `/api/v1/stories/${story.id}/boards`,
        { data: { workspaceId, name, tags } },
      );
      expect(response.status()).toBe(201);
      return response.json();
    };

    const boardA = await createBoard("Board A", ["characters", "draft"]);
    const boardB = await createBoard("Board B", ["characters"]);

    const createNode = async (
      boardId: string,
      name: string,
      x: number,
      y: number,
    ) => {
      const id = crypto.randomUUID();
      const response = await context.request.post(
        `/api/v1/boards/${boardId}/nodes`,
        {
          data: {
            workspaceId,
            id,
            name,
            description: "",
            properties: {},
            position: { x, y },
          },
        },
      );
      expect(response.status()).toBe(201);
      return { id, body: await response.json() };
    };

    const aliceA = await createNode(boardA.id, "Alice", 120, 180);
    const bobA = await createNode(boardA.id, "Bob", 420, 180);
    const aliceB = await createNode(boardB.id, "Alice", 160, 220);
    const bobB = await createNode(boardB.id, "Bob", 460, 220);

    const createEdge = async (
      boardId: string,
      sourceNodeId: string,
      targetNodeId: string,
      name: string,
    ) => {
      const id = crypto.randomUUID();
      const response = await context.request.post(
        `/api/v1/boards/${boardId}/edges`,
        {
          data: {
            workspaceId,
            id,
            sourceNodeId,
            targetNodeId,
            name,
            description: "",
            properties: {},
          },
        },
      );
      expect(response.status()).toBe(201);
      return { id, body: await response.json() };
    };

    const edgeA = await createEdge(boardA.id, aliceA.id, bobA.id, "knows");
    const edgeB = await createEdge(boardB.id, aliceB.id, bobB.id, "knows");

    const updateAliceA = await context.request.patch(
      `/api/v1/nodes/${aliceA.id}`,
      {
        data: {
          workspaceId,
          version: aliceA.body.node.version,
          name: "Queen Alice",
          description: "Board A only",
          properties: { board: "A" },
        },
      },
    );
    expect(updateAliceA.status()).toBe(200);

    const updateEdgeA = await context.request.patch(
      `/api/v1/edges/${edgeA.id}`,
      {
        data: {
          workspaceId,
          version: edgeA.body.edge.version,
          name: "protects",
          description: "Board A only",
          properties: { board: "A" },
        },
      },
    );
    expect(updateEdgeA.status()).toBe(200);

    const snapshotAResponse = await context.request.get(
      `/api/v1/boards/${boardA.id}/snapshot?workspaceId=${workspaceId}`,
    );
    const snapshotBResponse = await context.request.get(
      `/api/v1/boards/${boardB.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotAResponse.status()).toBe(200);
    expect(snapshotBResponse.status()).toBe(200);
    const snapshotA = await snapshotAResponse.json();
    const snapshotB = await snapshotBResponse.json();

    expect(snapshotA.nodes).toContainEqual(
      expect.objectContaining({
        id: aliceA.id,
        name: "Queen Alice",
        description: "Board A only",
        properties: { board: "A" },
      }),
    );
    expect(snapshotA.nodes.some((node: { id: string }) => node.id === aliceB.id)).toBe(
      false,
    );
    expect(snapshotB.nodes).toContainEqual(
      expect.objectContaining({ id: aliceB.id, name: "Alice" }),
    );
    expect(snapshotB.nodes.some((node: { id: string }) => node.id === aliceA.id)).toBe(
      false,
    );

    expect(snapshotA.edges).toContainEqual(
      expect.objectContaining({
        id: edgeA.id,
        name: "protects",
        description: "Board A only",
        properties: { board: "A" },
      }),
    );
    expect(snapshotA.edges.some((edge: { id: string }) => edge.id === edgeB.id)).toBe(
      false,
    );
    expect(snapshotB.edges).toContainEqual(
      expect.objectContaining({ id: edgeB.id, name: "knows" }),
    );
    expect(snapshotB.edges.some((edge: { id: string }) => edge.id === edgeA.id)).toBe(
      false,
    );

    await page.goto(`/stories/${story.id}`);
    await expect(page.getByRole("heading", { name: "Independent Boards Story" })).toBeVisible();
    await expect(page.getByText("#characters").first()).toBeVisible();
    await expect(page.getByText("컨텍스트", { exact: true })).toHaveCount(0);

    await page.goto(`/stories/${story.id}/boards/${boardA.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(page.getByText("Queen Alice", { exact: true })).toBeVisible();
    await expect(page.getByText("protects", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "노드 추가" }).click();
    await expect(page.getByLabel("기존 노드")).toHaveCount(0);
    await page.getByRole("button", { name: "취소" }).click();

    await page.goto(`/stories/${story.id}/boards/${boardB.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await expect(page.getByText("Alice", { exact: true })).toBeVisible();
    await expect(page.getByText("knows", { exact: true })).toBeVisible();
    await expect(page.getByText("Queen Alice", { exact: true })).toHaveCount(0);
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
