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
    name: "Board Removal Story",
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

function edge(
  storyId: string,
  sourceNodeId: string,
  targetNodeId: string,
): GraphEdge {
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

describe("Board removal presentation semantics", () => {
  it("removes incident BoardEdges with a BoardNode while preserving canonical Node and Edge", async () => {
    const workspace = await createWorkspace("Board Removal Owner");
    const story = await createStory(workspace.id);
    const graph = new DrizzleGraphRepository();
    const board = await graph.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
    });
    const alice = node(story.id, "Alice");
    const bob = node(story.id, "Bob");
    await graph.createNodeOnBoard({ boardId: board.id, node: alice, placement });
    await graph.createNodeOnBoard({
      boardId: board.id,
      node: bob,
      placement: { ...placement, x: 200 },
    });
    const relationship = edge(story.id, alice.id, bob.id);
    await graph.createEdgeOnBoard({ boardId: board.id, edge: relationship });

    await expect(graph.removeNodeFromBoard(board.id, alice.id)).resolves.toBe(true);

    const snapshot = await graph.getBoardSnapshot(board.id);
    expect(snapshot?.boardNodes.map((item) => item.nodeId)).toEqual([bob.id]);
    expect(snapshot?.boardEdges).toEqual([]);
    expect(snapshot?.edges).toEqual([]);
    await expect(graph.findNode(alice.id)).resolves.toMatchObject({ id: alice.id });
    await expect(graph.findEdge(relationship.id)).resolves.toMatchObject({
      id: relationship.id,
      sourceNodeId: alice.id,
      targetNodeId: bob.id,
    });
    await expect(graph.findBoard(board.id)).resolves.toMatchObject({ revision: 4 });
  });
});
