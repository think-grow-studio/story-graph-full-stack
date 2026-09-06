import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import {
  board,
  boardTag,
  graphEdge,
  graphNode,
  organization,
  user,
} from "@/backend/infrastructure/database/schema";
import type {
  CreateGraphEdge,
  CreateGraphNode,
  RestorableGraphEdge,
  RestorableGraphNode,
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

function makeNode(
  boardId: string,
  name: string,
  overrides: Partial<CreateGraphNode> = {},
): CreateGraphNode {
  return {
    id: crypto.randomUUID(),
    boardId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    ...overrides,
  };
}

function makeEdge(
  boardId: string,
  sourceNodeId: string,
  targetNodeId: string,
  name: string,
  overrides: Partial<CreateGraphEdge> = {},
): CreateGraphEdge {
  return {
    id: crypto.randomUUID(),
    boardId,
    sourceNodeId,
    targetNodeId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    style: {},
    labelPresentation: {},
    ...overrides,
  };
}

function restorableNode(value: {
  id: string;
  boardId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: Record<string, unknown>;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number;
  style: Record<string, unknown>;
  version: number;
}): RestorableGraphNode {
  return value;
}

function restorableEdge(value: {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: Record<string, unknown>;
  style: Record<string, unknown>;
  labelPresentation: Record<string, unknown>;
  version: number;
}): RestorableGraphEdge {
  return value;
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("DrizzleGraphRepository board-owned graph", () => {
  it("creates and lists Board tags as child values", async () => {
    const workspace = await createWorkspace("Board Tags Owner");
    const story = await createStory(workspace.id, "Board Tags Story");
    const repository = new DrizzleGraphRepository();

    const created = await repository.createBoard({
      storyId: story.id,
      name: "Characters",
      description: "Character map",
      tags: ["인물", "1부"],
    });

    expect(created).toMatchObject({
      storyId: story.id,
      name: "Characters",
      tags: ["인물", "1부"],
    });
    await expect(repository.listBoards(story.id)).resolves.toEqual([created]);
  });

  it("stores Board ownership, semantic fields and presentation on one Node row", async () => {
    const workspace = await createWorkspace("Board Node Owner");
    const story = await createStory(workspace.id, "Board Node Story");
    const repository = new DrizzleGraphRepository();
    const firstBoard = await repository.createBoard({
      storyId: story.id,
      name: "A",
      description: "",
      tags: [],
    });
    const secondBoard = await repository.createBoard({
      storyId: story.id,
      name: "B",
      description: "",
      tags: [],
    });

    const first = await repository.createNode(
      makeNode(firstBoard.id, "Alice", { x: 30, style: { role: "lead" } }),
    );
    const second = await repository.createNode(
      makeNode(secondBoard.id, "Alice", { x: 300 }),
    );

    expect(first).toMatchObject({
      boardId: firstBoard.id,
      name: "Alice",
      x: 30,
      style: { role: "lead" },
      version: 1,
    });
    expect(second).toMatchObject({ boardId: secondBoard.id, name: "Alice", x: 300 });
    expect(second.id).not.toBe(first.id);
  });

  it("rejects an Edge whose endpoint belongs to another Board", async () => {
    const workspace = await createWorkspace("Cross Board Edge Owner");
    const story = await createStory(workspace.id, "Cross Board Edge Story");
    const repository = new DrizzleGraphRepository();
    const firstBoard = await repository.createBoard({
      storyId: story.id,
      name: "A",
      description: "",
      tags: [],
    });
    const secondBoard = await repository.createBoard({
      storyId: story.id,
      name: "B",
      description: "",
      tags: [],
    });
    const firstNode = await repository.createNode(makeNode(firstBoard.id, "A"));
    const secondNode = await repository.createNode(makeNode(secondBoard.id, "B"));

    await expect(
      repository.createEdge(
        makeEdge(firstBoard.id, firstNode.id, secondNode.id, "invalid"),
      ),
    ).rejects.toBeTruthy();
  });

  it("cascades Board deletion to tags, Nodes and Edges", async () => {
    const workspace = await createWorkspace("Cascade Owner");
    const story = await createStory(workspace.id, "Cascade Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
      tags: ["delete-me"],
    });
    const source = await repository.createNode(makeNode(createdBoard.id, "Source"));
    const target = await repository.createNode(makeNode(createdBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(createdBoard.id, source.id, target.id, "connects"),
    );

    await db.delete(board).where(eq(board.id, createdBoard.id));

    await expect(
      db.select().from(boardTag).where(eq(boardTag.boardId, createdBoard.id)),
    ).resolves.toHaveLength(0);
    await expect(
      db.select().from(graphNode).where(eq(graphNode.boardId, createdBoard.id)),
    ).resolves.toHaveLength(0);
    await expect(
      db.select().from(graphEdge).where(eq(graphEdge.id, edge.id)),
    ).resolves.toHaveLength(0);
  });

  it("deletes a Node with incident Edges and returns an Undo snapshot", async () => {
    const workspace = await createWorkspace("Delete Node Owner");
    const story = await createStory(workspace.id, "Delete Node Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
      tags: [],
    });
    const source = await repository.createNode(makeNode(createdBoard.id, "Source"));
    const target = await repository.createNode(makeNode(createdBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(createdBoard.id, source.id, target.id, "connects"),
    );

    const deleted = await repository.deleteNode(createdBoard.id, source.id);

    expect(deleted?.node.id).toBe(source.id);
    expect(deleted?.edges.map((item) => item.id)).toEqual([edge.id]);
    await expect(repository.findNode(createdBoard.id, source.id)).resolves.toBeNull();
    await expect(repository.findEdge(createdBoard.id, edge.id)).resolves.toBeNull();
  });

  it("uses row-level compare-and-swap for Node and Edge updates", async () => {
    const workspace = await createWorkspace("CAS Owner");
    const story = await createStory(workspace.id, "CAS Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
      tags: [],
    });
    const source = await repository.createNode(makeNode(createdBoard.id, "Source"));
    const target = await repository.createNode(makeNode(createdBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(createdBoard.id, source.id, target.id, "connects"),
    );

    const moved = await repository.updateNode({
      boardId: createdBoard.id,
      id: source.id,
      expectedVersion: 1,
      x: 77,
      name: "Moved Source",
    });
    expect(moved).toMatchObject({ x: 77, name: "Moved Source", version: 2 });
    await expect(
      repository.updateNode({
        boardId: createdBoard.id,
        id: source.id,
        expectedVersion: 1,
        x: 88,
      }),
    ).resolves.toBeNull();

    const renamedEdge = await repository.updateEdge({
      boardId: createdBoard.id,
      id: edge.id,
      expectedVersion: 1,
      name: "protects",
      style: { dashed: true },
    });
    expect(renamedEdge).toMatchObject({
      name: "protects",
      style: { dashed: true },
      version: 2,
    });
  });

  it("restores the same Node and incident Edge UUIDs and versions transactionally", async () => {
    const workspace = await createWorkspace("Restore Owner");
    const story = await createStory(workspace.id, "Restore Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
      tags: [],
    });
    const source = await repository.createNode(makeNode(createdBoard.id, "Source"));
    const target = await repository.createNode(makeNode(createdBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(createdBoard.id, source.id, target.id, "connects"),
    );
    const updatedSource = await repository.updateNode({
      boardId: createdBoard.id,
      id: source.id,
      expectedVersion: source.version,
      x: 44,
    });
    expect(updatedSource).not.toBeNull();

    const deleted = await repository.deleteNode(createdBoard.id, source.id);
    expect(deleted).not.toBeNull();

    const restored = await repository.restoreNode({
      boardId: createdBoard.id,
      node: restorableNode({
        id: deleted!.node.id,
        boardId: deleted!.node.boardId,
        name: deleted!.node.name,
        description: deleted!.node.description,
        iconKey: deleted!.node.iconKey,
        properties: deleted!.node.properties,
        x: deleted!.node.x,
        y: deleted!.node.y,
        width: deleted!.node.width,
        height: deleted!.node.height,
        zIndex: deleted!.node.zIndex,
        style: deleted!.node.style,
        version: deleted!.node.version,
      }),
      edges: deleted!.edges.map((item) =>
        restorableEdge({
          id: item.id,
          boardId: item.boardId,
          sourceNodeId: item.sourceNodeId,
          targetNodeId: item.targetNodeId,
          name: item.name,
          description: item.description,
          iconKey: item.iconKey,
          properties: item.properties,
          style: item.style,
          labelPresentation: item.labelPresentation,
          version: item.version,
        }),
      ),
    });

    expect(restored?.node).toMatchObject({
      id: source.id,
      boardId: createdBoard.id,
      version: updatedSource!.version,
      x: 44,
    });
    expect(restored?.edges[0]).toMatchObject({ id: edge.id, version: edge.version });
  });

  it("returns a direct Board snapshot with no presentation/state side tables", async () => {
    const workspace = await createWorkspace("Snapshot Owner");
    const story = await createStory(workspace.id, "Snapshot Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await repository.createBoard({
      storyId: story.id,
      name: "Main",
      description: "",
      tags: ["snapshot"],
    });
    const source = await repository.createNode(makeNode(createdBoard.id, "Source"));
    const target = await repository.createNode(makeNode(createdBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(createdBoard.id, source.id, target.id, "connects"),
    );

    const snapshot = await repository.getBoardSnapshot(createdBoard.id);

    expect(snapshot).toEqual({
      board: createdBoard,
      nodes: [source, target],
      edges: [edge],
    });
  });

  it("scopes entity lookup by Board id", async () => {
    const workspace = await createWorkspace("Lookup Owner");
    const story = await createStory(workspace.id, "Lookup Story");
    const repository = new DrizzleGraphRepository();
    const firstBoard = await repository.createBoard({
      storyId: story.id,
      name: "A",
      description: "",
      tags: [],
    });
    const secondBoard = await repository.createBoard({
      storyId: story.id,
      name: "B",
      description: "",
      tags: [],
    });
    const node = await repository.createNode(makeNode(firstBoard.id, "Only A"));

    await expect(repository.findNode(firstBoard.id, node.id)).resolves.toMatchObject({
      id: node.id,
    });
    await expect(repository.findNode(secondBoard.id, node.id)).resolves.toBeNull();

    const rows = await db
      .select({ id: graphNode.id })
      .from(graphNode)
      .where(and(eq(graphNode.id, node.id), eq(graphNode.boardId, firstBoard.id)));
    expect(rows).toHaveLength(1);
  });
});
