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

test("Boards keep same-named Nodes and Relationships independent", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Board Independence User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(
      context.request,
      workspaceId,
      "Independent Boards Story",
    );
    const boardA = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Board A",
      ["characters", "draft"],
    );
    const boardB = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Board B",
      ["characters"],
    );

    const aliceA = await createE2ENode(context.request, boardA.id, workspaceId, {
      name: "Alice",
      x: 120,
      y: 180,
    });
    const bobA = await createE2ENode(context.request, boardA.id, workspaceId, {
      name: "Bob",
      x: 420,
      y: 180,
    });
    const aliceB = await createE2ENode(context.request, boardB.id, workspaceId, {
      name: "Alice",
      x: 160,
      y: 220,
    });
    const bobB = await createE2ENode(context.request, boardB.id, workspaceId, {
      name: "Bob",
      x: 460,
      y: 220,
    });

    const edgeA = await createE2EEdge(context.request, boardA.id, workspaceId, {
      sourceNodeId: aliceA.id,
      targetNodeId: bobA.id,
      name: "knows",
    });
    const edgeB = await createE2EEdge(context.request, boardB.id, workspaceId, {
      sourceNodeId: aliceB.id,
      targetNodeId: bobB.id,
      name: "knows",
    });

    const updateAliceA = await context.request.patch(
      `/api/v1/boards/${boardA.id}/nodes/${aliceA.id}`,
      {
        data: {
          workspaceId,
          expectedVersion: aliceA.version,
          name: "Queen Alice",
          description: "Board A only",
          properties: { board: "A" },
        },
      },
    );
    expect(updateAliceA.status()).toBe(200);

    const updateEdgeA = await context.request.patch(
      `/api/v1/boards/${boardA.id}/edges/${edgeA.id}`,
      {
        data: {
          workspaceId,
          expectedVersion: edgeA.version,
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
        boardId: boardA.id,
        name: "Queen Alice",
        description: "Board A only",
        properties: { board: "A" },
      }),
    );
    expect(snapshotA.nodes.some((node: { id: string }) => node.id === aliceB.id)).toBe(false);
    expect(snapshotB.nodes).toContainEqual(
      expect.objectContaining({ id: aliceB.id, boardId: boardB.id, name: "Alice" }),
    );
    expect(snapshotB.nodes.some((node: { id: string }) => node.id === aliceA.id)).toBe(false);

    expect(snapshotA.edges).toContainEqual(
      expect.objectContaining({
        id: edgeA.id,
        boardId: boardA.id,
        name: "protects",
        description: "Board A only",
        properties: { board: "A" },
      }),
    );
    expect(snapshotA.edges.some((edge: { id: string }) => edge.id === edgeB.id)).toBe(false);
    expect(snapshotB.edges).toContainEqual(
      expect.objectContaining({ id: edgeB.id, boardId: boardB.id, name: "knows" }),
    );
    expect(snapshotB.edges.some((edge: { id: string }) => edge.id === edgeA.id)).toBe(false);

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
