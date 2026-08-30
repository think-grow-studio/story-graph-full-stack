import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";
import type { GraphEdge, GraphNode } from "@/backend/modules/graph/domain/graph";
import { DrizzleGraphRepository } from "@/backend/modules/graph/infrastructure/drizzle-graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import { DrizzleStoryRepository } from "@/backend/modules/story/infrastructure/drizzle-story.repository";
import { ensurePersonalWorkspace } from "@/backend/modules/workspace/application/ensure-personal-workspace/ensure-personal-workspace";
import { BetterAuthWorkspaceProvisioner } from "@/backend/modules/workspace/infrastructure/better-auth-workspace-provisioner";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";
import { createTestIdentity } from "../../helpers/test-auth";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

async function createWorkspace(name: string) {
  const identity = await createTestIdentity(name);
  createdUserIds.push(identity.user.id);
  const workspace = await ensurePersonalWorkspace(
    { userId: identity.user.id, userName: identity.user.name },
    {
      access: new DrizzleWorkspaceAccessService(),
      provisioner: new BetterAuthWorkspaceProvisioner(),
    },
  );
  createdOrganizationIds.push(workspace.id);
  return workspace;
}

async function createStory(workspaceId: string): Promise<Story> {
  const now = new Date();
  const story: Story = {
    id: crypto.randomUUID(),
    workspaceId,
    name: "Board Edge Restore Story",
    description: "",
    createdAt: now,
    updatedAt: now,
  };
  await new DrizzleStoryRepository().create(story);
  return story;
}

function node(storyId: string, name: string): GraphNode {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    storyId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function edge(storyId: string, sourceNodeId: string, targetNodeId: string): GraphEdge {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    storyId,
    sourceNodeId,
    targetNodeId,
    name: "knows",
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

const placement = {
  x: 10,
  y: 20,
  width: null,
  height: null,
  zIndex: 0,
  style: {},
};

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("BoardEdge restore persistence", () => {
  it("restores presentation idempotently and increments Board revision only for the first restore", async () => {
    const workspace = await createWorkspace("Board Edge Restore Owner");
    const story = await createStory(workspace.id);
    const graph = new DrizzleGraphRepository();
    const board = await graph.createBoard({ storyId: story.id, name: "Main", description: "" });
    const source = node(story.id, "Source");
    const target = node(story.id, "Target");
    await graph.createNodeOnBoard({ boardId: board.id, node: source, placement });
    await graph.createNodeOnBoard({
      boardId: board.id,
      node: target,
      placement: { ...placement, x: 200 },
    });
    const relationship = edge(story.id, source.id, target.id);
    await graph.createEdgeOnBoard({ boardId: board.id, edge: relationship });
    await graph.removeEdgeFromBoard(board.id, relationship.id);

    const restoreInput = {
      boardId: board.id,
      edgeId: relationship.id,
      style: { stroke: "dashed" },
      labelPresentation: { hidden: false },
    };
    const first = await graph.restoreEdgeToBoard(restoreInput);
    const second = await graph.restoreEdgeToBoard(restoreInput);

    expect(first).toMatchObject({
      edge: { id: relationship.id },
      boardEdge: {
        boardId: board.id,
        edgeId: relationship.id,
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
      },
    });
    expect(second).toEqual(first);

    const snapshot = await graph.getBoardSnapshot(board.id);
    expect(snapshot?.edges).toEqual([expect.objectContaining({ id: relationship.id })]);
    expect(snapshot?.boardEdges).toEqual([
      expect.objectContaining({
        edgeId: relationship.id,
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
      }),
    ]);
    await expect(graph.findBoard(board.id)).resolves.toMatchObject({ revision: 5 });
  });

  it("refuses to restore a BoardEdge when either endpoint is no longer on the Board", async () => {
    const workspace = await createWorkspace("Board Edge Missing Endpoint Owner");
    const story = await createStory(workspace.id);
    const graph = new DrizzleGraphRepository();
    const board = await graph.createBoard({ storyId: story.id, name: "Main", description: "" });
    const source = node(story.id, "Source");
    const target = node(story.id, "Target");
    await graph.createNodeOnBoard({ boardId: board.id, node: source, placement });
    await graph.createNodeOnBoard({
      boardId: board.id,
      node: target,
      placement: { ...placement, x: 200 },
    });
    const relationship = edge(story.id, source.id, target.id);
    await graph.createEdgeOnBoard({ boardId: board.id, edge: relationship });
    await graph.removeEdgeFromBoard(board.id, relationship.id);
    await graph.removeNodeFromBoard(board.id, source.id);

    await expect(
      graph.restoreEdgeToBoard({
        boardId: board.id,
        edgeId: relationship.id,
        style: {},
        labelPresentation: {},
      }),
    ).resolves.toBeNull();

    const snapshot = await graph.getBoardSnapshot(board.id);
    expect(snapshot?.boardEdges).toEqual([]);
  });
});
