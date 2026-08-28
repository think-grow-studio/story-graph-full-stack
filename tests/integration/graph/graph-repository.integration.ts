import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardEdge,
  boardNode,
  graphEdge,
  graphNode,
  organization,
  user,
} from "@/backend/infrastructure/database/schema";
import type {
  GraphEdge,
  GraphNode,
} from "@/backend/modules/graph/domain/graph";
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

async function createStory(workspaceId: string, name: string) {
  const now = new Date();
  const story: Story = {
    id: crypto.randomUUID(),
    workspaceId,
    name,
    description: "",
    createdAt: now,
    updatedAt: now,
  };

  await new DrizzleStoryRepository().create(story);
  return story;
}

function makeNode(storyId: string, name: string): GraphNode {
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

function makeEdge(
  storyId: string,
  sourceNodeId: string,
  targetNodeId: string,
  name: string,
): GraphEdge {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    storyId,
    sourceNodeId,
    targetNodeId,
    name,
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

describe("graph database invariants", () => {
  it("allows multiple directed edges with the same source and target", async () => {
    const workspace = await createWorkspace("Multi Edge Owner");
    const story = await createStory(workspace.id, "Multi Edge Story");
    const sourceId = crypto.randomUUID();
    const targetId = crypto.randomUUID();

    await db.insert(graphNode).values([
      { id: sourceId, storyId: story.id, name: "Source" },
      { id: targetId, storyId: story.id, name: "Target" },
    ]);

    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    await db.insert(graphEdge).values([
      {
        id: firstId,
        storyId: story.id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        name: "trusts",
      },
      {
        id: secondId,
        storyId: story.id,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        name: "protects",
      },
    ]);

    const rows = await db
      .select({ id: graphEdge.id })
      .from(graphEdge)
      .where(eq(graphEdge.storyId, story.id));

    expect(rows.map((row) => row.id).sort()).toEqual([firstId, secondId].sort());
  });

  it("rejects an edge whose endpoint belongs to another Story", async () => {
    const workspace = await createWorkspace("Cross Story Edge Owner");
    const firstStory = await createStory(workspace.id, "First Story");
    const secondStory = await createStory(workspace.id, "Second Story");
    const firstNodeId = crypto.randomUUID();
    const secondNodeId = crypto.randomUUID();

    await db.insert(graphNode).values([
      { id: firstNodeId, storyId: firstStory.id, name: "First Node" },
      { id: secondNodeId, storyId: secondStory.id, name: "Second Node" },
    ]);

    await expect(
      db.insert(graphEdge).values({
        id: crypto.randomUUID(),
        storyId: firstStory.id,
        sourceNodeId: firstNodeId,
        targetNodeId: secondNodeId,
        name: "invalid",
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects Board presentation rows that reference another Story", async () => {
    const workspace = await createWorkspace("Cross Story Board Owner");
    const firstStory = await createStory(workspace.id, "Board Story");
    const secondStory = await createStory(workspace.id, "Other Story");
    const firstBoardId = crypto.randomUUID();
    const firstNodeId = crypto.randomUUID();
    const secondNodeId = crypto.randomUUID();

    await db.insert(board).values({
      id: firstBoardId,
      storyId: firstStory.id,
      name: "Main Board",
    });
    await db.insert(graphNode).values([
      { id: firstNodeId, storyId: firstStory.id, name: "First Node" },
      { id: secondNodeId, storyId: secondStory.id, name: "Second Node" },
    ]);

    await expect(
      db.insert(boardNode).values({
        boardId: firstBoardId,
        nodeId: secondNodeId,
        storyId: firstStory.id,
        x: 0,
        y: 0,
      }),
    ).rejects.toBeTruthy();

    const otherEdgeId = crypto.randomUUID();
    await db.insert(graphEdge).values({
      id: otherEdgeId,
      storyId: secondStory.id,
      sourceNodeId: secondNodeId,
      targetNodeId: secondNodeId,
      name: "self",
    });

    await expect(
      db.insert(boardEdge).values({
        boardId: firstBoardId,
        edgeId: otherEdgeId,
        storyId: firstStory.id,
      }),
    ).rejects.toBeTruthy();

    const validBoardNodeId = crypto.randomUUID();
    await db.insert(graphNode).values({
      id: validBoardNodeId,
      storyId: firstStory.id,
      name: "Valid Board Node",
    });
    await expect(
      db.insert(boardNode).values({
        boardId: firstBoardId,
        nodeId: validBoardNodeId,
        storyId: firstStory.id,
        x: 10,
        y: 20,
      }),
    ).resolves.toBeDefined();
  });
});

describe("DrizzleGraphRepository", () => {
  it("creates a Board at revision zero", async () => {
    const workspace = await createWorkspace("Board Repository Owner");
    const story = await createStory(workspace.id, "Board Repository Story");
    const repository = new DrizzleGraphRepository();

    const created = await repository.createBoard({
      storyId: story.id,
      name: "Main Board",
      description: "Primary view",
    });

    expect(created.storyId).toBe(story.id);
    expect(created.revision).toBe(0);
    await expect(repository.findBoard(created.id)).resolves.toMatchObject({
      id: created.id,
      revision: 0,
    });
  });

  it("creates Node + BoardNode atomically and increments Board revision once", async () => {
    const workspace = await createWorkspace("Node Transaction Owner");
    const story = await createStory(workspace.id, "Node Transaction Story");
    const otherStory = await createStory(workspace.id, "Other Node Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
    });
    const node = makeNode(story.id, "Alice");

    const result = await repository.createNodeOnBoard({
      boardId: createdBoard.id,
      node,
      placement,
    });

    expect(result.node.id).toBe(node.id);
    expect(result.boardNode).toMatchObject({
      boardId: createdBoard.id,
      nodeId: node.id,
      x: 10,
      y: 20,
    });
    await expect(repository.findBoard(createdBoard.id)).resolves.toMatchObject({
      revision: 1,
    });

    const invalidNode = makeNode(otherStory.id, "Wrong Story");
    await expect(
      repository.createNodeOnBoard({
        boardId: createdBoard.id,
        node: invalidNode,
        placement,
      }),
    ).rejects.toBeTruthy();
    await expect(repository.findNode(invalidNode.id)).resolves.toBeNull();
    await expect(repository.findBoard(createdBoard.id)).resolves.toMatchObject({
      revision: 1,
    });
  });

  it("updates and removes BoardNode presentation while preserving the canonical Node", async () => {
    const workspace = await createWorkspace("Placement Owner");
    const story = await createStory(workspace.id, "Placement Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
    });
    const node = makeNode(story.id, "Alice");
    await repository.createNodeOnBoard({
      boardId: createdBoard.id,
      node,
      placement,
    });

    const updated = await repository.updateBoardNode({
      boardId: createdBoard.id,
      nodeId: node.id,
      x: 50,
      y: 60,
      zIndex: 3,
      style: { emphasized: true },
    });
    expect(updated).toMatchObject({ x: 50, y: 60, zIndex: 3 });
    await expect(repository.findBoard(createdBoard.id)).resolves.toMatchObject({
      revision: 2,
    });

    await expect(
      repository.removeNodeFromBoard(createdBoard.id, node.id),
    ).resolves.toBe(true);
    await expect(repository.findBoard(createdBoard.id)).resolves.toMatchObject({
      revision: 3,
    });
    await expect(repository.findNode(node.id)).resolves.toMatchObject({ id: node.id });
  });

  it("creates/removes BoardEdge membership and preserves the canonical Edge", async () => {
    const workspace = await createWorkspace("Edge Transaction Owner");
    const story = await createStory(workspace.id, "Edge Transaction Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
    });
    const source = makeNode(story.id, "Source");
    const target = makeNode(story.id, "Target");
    await repository.createNodeOnBoard({ boardId: createdBoard.id, node: source, placement });
    await repository.createNodeOnBoard({
      boardId: createdBoard.id,
      node: target,
      placement: { ...placement, x: 100 },
    });
    const edge = makeEdge(story.id, source.id, target.id, "trusts");

    const created = await repository.createEdgeOnBoard({
      boardId: createdBoard.id,
      edge,
    });
    expect(created.edge.id).toBe(edge.id);
    expect(created.boardEdge).toMatchObject({
      boardId: createdBoard.id,
      edgeId: edge.id,
    });
    await expect(repository.findBoard(createdBoard.id)).resolves.toMatchObject({
      revision: 3,
    });

    await expect(
      repository.removeEdgeFromBoard(createdBoard.id, edge.id),
    ).resolves.toBe(true);
    await expect(repository.findBoard(createdBoard.id)).resolves.toMatchObject({
      revision: 4,
    });
    await expect(repository.findEdge(edge.id)).resolves.toMatchObject({ id: edge.id });
  });

  it("returns one snapshot containing only entities represented on the Board", async () => {
    const workspace = await createWorkspace("Snapshot Owner");
    const story = await createStory(workspace.id, "Snapshot Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
    });
    const source = makeNode(story.id, "Visible Source");
    const target = makeNode(story.id, "Visible Target");
    await repository.createNodeOnBoard({ boardId: createdBoard.id, node: source, placement });
    await repository.createNodeOnBoard({
      boardId: createdBoard.id,
      node: target,
      placement: { ...placement, x: 100 },
    });
    const visibleEdge = makeEdge(story.id, source.id, target.id, "visible");
    await repository.createEdgeOnBoard({ boardId: createdBoard.id, edge: visibleEdge });

    const hiddenNode = makeNode(story.id, "Hidden Node");
    await db.insert(graphNode).values(hiddenNode);
    const hiddenEdge = makeEdge(story.id, hiddenNode.id, hiddenNode.id, "hidden");
    await db.insert(graphEdge).values(hiddenEdge);

    const snapshot = await repository.getBoardSnapshot(createdBoard.id);

    expect(snapshot?.board.id).toBe(createdBoard.id);
    expect(snapshot?.nodes.map((item) => item.id).sort()).toEqual(
      [source.id, target.id].sort(),
    );
    expect(snapshot?.edges.map((item) => item.id)).toEqual([visibleEdge.id]);
    expect(snapshot?.boardNodes).toHaveLength(2);
    expect(snapshot?.boardEdges).toHaveLength(1);
    expect(snapshot?.nodes.some((item) => item.id === hiddenNode.id)).toBe(false);
    expect(snapshot?.edges.some((item) => item.id === hiddenEdge.id)).toBe(false);
  });

  it("uses compare-and-swap for Node and Edge updates without changing Board revision", async () => {
    const workspace = await createWorkspace("Optimistic Lock Owner");
    const story = await createStory(workspace.id, "Optimistic Lock Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
    });
    const source = makeNode(story.id, "Source");
    const target = makeNode(story.id, "Target");
    await repository.createNodeOnBoard({ boardId: createdBoard.id, node: source, placement });
    await repository.createNodeOnBoard({
      boardId: createdBoard.id,
      node: target,
      placement: { ...placement, x: 100 },
    });
    const edge = makeEdge(story.id, source.id, target.id, "trusts");
    await repository.createEdgeOnBoard({ boardId: createdBoard.id, edge });
    const revisionBeforeCanonicalUpdates = (await repository.findBoard(createdBoard.id))?.revision;

    const updatedNode = await repository.updateNode({
      id: source.id,
      expectedVersion: 1,
      name: "Updated Source",
      properties: { role: "hero" },
    });
    expect(updatedNode).toMatchObject({
      name: "Updated Source",
      version: 2,
      properties: { role: "hero" },
    });
    await expect(
      repository.updateNode({
        id: source.id,
        expectedVersion: 1,
        name: "Stale Source",
      }),
    ).resolves.toBeNull();
    await expect(repository.findNode(source.id)).resolves.toMatchObject({
      name: "Updated Source",
      version: 2,
    });

    const updatedEdge = await repository.updateEdge({
      id: edge.id,
      expectedVersion: 1,
      description: "updated",
    });
    expect(updatedEdge).toMatchObject({ description: "updated", version: 2 });
    await expect(
      repository.updateEdge({
        id: edge.id,
        expectedVersion: 1,
        description: "stale",
      }),
    ).resolves.toBeNull();
    await expect(repository.findEdge(edge.id)).resolves.toMatchObject({
      description: "updated",
      version: 2,
    });

    await expect(repository.findBoard(createdBoard.id)).resolves.toMatchObject({
      revision: revisionBeforeCanonicalUpdates,
    });
  });
});
