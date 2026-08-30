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
    name: "Board Node Restore Story",
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
  width: 180,
  height: 90,
  zIndex: 3,
  style: { tint: "violet" },
};

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("BoardNode restore persistence", () => {
  it("restores Node and incident Relationship presentation idempotently with one revision increment", async () => {
    const workspace = await createWorkspace("Board Node Restore Owner");
    const story = await createStory(workspace.id);
    const graph = new DrizzleGraphRepository();
    const board = await graph.createBoard({ storyId: story.id, name: "Main", description: "" });
    const source = node(story.id, "Source");
    const target = node(story.id, "Target");
    await graph.createNodeOnBoard({ boardId: board.id, node: source, placement });
    await graph.createNodeOnBoard({
      boardId: board.id,
      node: target,
      placement: { ...placement, x: 300, style: {} },
    });
    const relationship = edge(story.id, source.id, target.id);
    await graph.createEdgeOnBoard({ boardId: board.id, edge: relationship });
    await graph.removeNodeFromBoard(board.id, source.id);

    const restoreInput = {
      boardId: board.id,
      nodeId: source.id,
      placement,
      boardEdges: [
        {
          edgeId: relationship.id,
          style: { stroke: "dashed" },
          labelPresentation: { hidden: false },
        },
      ],
    };
    const first = await graph.restoreNodeToBoard(restoreInput);
    const second = await graph.restoreNodeToBoard(restoreInput);

    expect(first).toMatchObject({
      node: { id: source.id },
      boardNode: {
        boardId: board.id,
        nodeId: source.id,
        x: 10,
        y: 20,
        width: 180,
        height: 90,
        zIndex: 3,
        style: { tint: "violet" },
      },
      edges: [{ id: relationship.id }],
      boardEdges: [
        {
          edgeId: relationship.id,
          style: { stroke: "dashed" },
          labelPresentation: { hidden: false },
        },
      ],
    });
    expect(second).toEqual(first);

    const snapshot = await graph.getBoardSnapshot(board.id);
    expect(snapshot?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: source.id }),
        expect.objectContaining({ id: target.id }),
      ]),
    );
    expect(snapshot?.edges).toEqual([
      expect.objectContaining({ id: relationship.id }),
    ]);
    await expect(graph.findBoard(board.id)).resolves.toMatchObject({ revision: 5 });
  });

  it("refuses to restore incident BoardEdges when the other endpoint is no longer represented", async () => {
    const workspace = await createWorkspace("Board Node Missing Endpoint Owner");
    const story = await createStory(workspace.id);
    const graph = new DrizzleGraphRepository();
    const board = await graph.createBoard({ storyId: story.id, name: "Main", description: "" });
    const source = node(story.id, "Source");
    const target = node(story.id, "Target");
    await graph.createNodeOnBoard({ boardId: board.id, node: source, placement });
    await graph.createNodeOnBoard({ boardId: board.id, node: target, placement });
    const relationship = edge(story.id, source.id, target.id);
    await graph.createEdgeOnBoard({ boardId: board.id, edge: relationship });
    await graph.removeNodeFromBoard(board.id, source.id);
    await graph.removeNodeFromBoard(board.id, target.id);

    await expect(
      graph.restoreNodeToBoard({
        boardId: board.id,
        nodeId: source.id,
        placement,
        boardEdges: [
          { edgeId: relationship.id, style: {}, labelPresentation: {} },
        ],
      }),
    ).resolves.toBeNull();

    const snapshot = await graph.getBoardSnapshot(board.id);
    expect(snapshot?.boardNodes).toEqual([]);
    expect(snapshot?.boardEdges).toEqual([]);
  });
});
