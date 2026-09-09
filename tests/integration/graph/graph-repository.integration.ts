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
  EdgePresentation,
  EdgeRouting,
  GraphSettings,
  NodePresentation,
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

const graphSettings: GraphSettings = {
  defaultEdgeRouting: "orthogonal",
  snapToGrid: false,
  layoutMode: "free",
};

const nodePresentation: NodePresentation = {
  shape: "rounded-rect",
  fillColor: null,
  borderColor: null,
  borderWidth: null,
  textColor: null,
};

const edgePresentation: EdgePresentation = {
  strokeColor: null,
  strokeWidth: null,
  strokeStyle: "solid",
  labelColor: null,
};

const edgeRouting: EdgeRouting = {
  type: "orthogonal",
  sourcePort: "auto",
  targetPort: "auto",
  waypoints: [],
};

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

async function createBoardFixture(
  repository: DrizzleGraphRepository,
  storyId: string,
  name: string,
) {
  return repository.createBoard({
    storyId,
    name,
    description: "",
    tags: [],
    graphSettings,
  });
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
    kind: "entity",
    iconKey: null,
    properties: {},
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    presentation: nodePresentation,
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
    direction: "DIRECTED",
    name,
    description: "",
    kind: "relationship",
    iconKey: null,
    properties: {},
    presentation: edgePresentation,
    routing: edgeRouting,
    ...overrides,
  };
}

function restorableNode(value: RestorableGraphNode): RestorableGraphNode {
  return value;
}

function restorableEdge(value: RestorableGraphEdge): RestorableGraphEdge {
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

describe("DrizzleGraphRepository Graph Editor V2", () => {
  it("persists Board graph settings and child tags", async () => {
    const workspace = await createWorkspace("Board Settings Owner");
    const story = await createStory(workspace.id, "Board Settings Story");
    const repository = new DrizzleGraphRepository();

    const created = await repository.createBoard({
      storyId: story.id,
      name: "Characters",
      description: "Character map",
      tags: ["인물", "1부"],
      graphSettings: { ...graphSettings, defaultEdgeRouting: "straight" },
    });

    expect(created).toMatchObject({
      storyId: story.id,
      name: "Characters",
      graphSettings: { ...graphSettings, defaultEdgeRouting: "straight" },
    });
    expect(created.tags).toEqual(expect.arrayContaining(["인물", "1부"]));
    await expect(repository.listBoards(story.id)).resolves.toEqual([created]);
  });

  it("persists Node semantics, recursive string properties and presentation on one row", async () => {
    const workspace = await createWorkspace("Node V2 Owner");
    const story = await createStory(workspace.id, "Node V2 Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await createBoardFixture(repository, story.id, "Main");

    const node = await repository.createNode(
      makeNode(createdBoard.id, "Alice", {
        kind: "person",
        properties: {
          직업: "마법사",
          "사는 곳": { 나라: "A 나라", 도시: "B 도시" },
          별명: ["붉은 마법사", "북부의 현자"],
        },
        x: 30,
        presentation: {
          ...nodePresentation,
          shape: "ellipse",
          fillColor: "#ffffff",
        },
      }),
    );

    expect(node).toMatchObject({
      boardId: createdBoard.id,
      name: "Alice",
      kind: "person",
      x: 30,
      properties: {
        직업: "마법사",
        "사는 곳": { 나라: "A 나라", 도시: "B 도시" },
      },
      presentation: { shape: "ellipse", fillColor: "#ffffff" },
      version: 1,
    });
  });

  it("stores opposite directed, undirected and parallel relationships as independent Edges", async () => {
    const workspace = await createWorkspace("Relationship V2 Owner");
    const story = await createStory(workspace.id, "Relationship V2 Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await createBoardFixture(repository, story.id, "Main");
    const alice = await repository.createNode(makeNode(createdBoard.id, "Alice"));
    const bob = await repository.createNode(makeNode(createdBoard.id, "Bob"));

    const aliceToBob = await repository.createEdge(
      makeEdge(createdBoard.id, alice.id, bob.id, "친구라고 생각함"),
    );
    const bobToAlice = await repository.createEdge(
      makeEdge(createdBoard.id, bob.id, alice.id, "친구라고 속임"),
    );
    const sibling = await repository.createEdge(
      makeEdge(createdBoard.id, alice.id, bob.id, "같은 조직", {
        direction: "UNDIRECTED",
      }),
    );
    const parallel = await repository.createEdge(
      makeEdge(createdBoard.id, alice.id, bob.id, "의존함"),
    );

    expect(new Set([aliceToBob.id, bobToAlice.id, sibling.id, parallel.id]).size).toBe(4);
    expect(aliceToBob).toMatchObject({
      sourceNodeId: alice.id,
      targetNodeId: bob.id,
      direction: "DIRECTED",
      name: "친구라고 생각함",
    });
    expect(bobToAlice).toMatchObject({
      sourceNodeId: bob.id,
      targetNodeId: alice.id,
      direction: "DIRECTED",
      name: "친구라고 속임",
    });
    expect(sibling.direction).toBe("UNDIRECTED");
  });

  it("rejects an Edge whose endpoint belongs to another Board", async () => {
    const workspace = await createWorkspace("Cross Board Edge Owner");
    const story = await createStory(workspace.id, "Cross Board Edge Story");
    const repository = new DrizzleGraphRepository();
    const firstBoard = await createBoardFixture(repository, story.id, "A");
    const secondBoard = await createBoardFixture(repository, story.id, "B");
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
      graphSettings,
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

  it("uses row-level CAS for Node presentation and Edge semantics/routing", async () => {
    const workspace = await createWorkspace("CAS V2 Owner");
    const story = await createStory(workspace.id, "CAS V2 Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await createBoardFixture(repository, story.id, "Main");
    const source = await repository.createNode(makeNode(createdBoard.id, "Source"));
    const target = await repository.createNode(makeNode(createdBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(createdBoard.id, source.id, target.id, "connects"),
    );

    const updatedNode = await repository.updateNode({
      boardId: createdBoard.id,
      id: source.id,
      expectedVersion: 1,
      kind: "person",
      x: 77,
      presentation: { ...nodePresentation, shape: "diamond" },
    });
    expect(updatedNode).toMatchObject({
      kind: "person",
      x: 77,
      presentation: { shape: "diamond" },
      version: 2,
    });
    await expect(
      repository.updateNode({
        boardId: createdBoard.id,
        id: source.id,
        expectedVersion: 1,
        x: 88,
      }),
    ).resolves.toBeNull();

    const updatedEdge = await repository.updateEdge({
      boardId: createdBoard.id,
      id: edge.id,
      expectedVersion: 1,
      direction: "UNDIRECTED",
      name: "형제",
      presentation: { ...edgePresentation, strokeStyle: "dashed" },
      routing: { ...edgeRouting, type: "straight" },
    });
    expect(updatedEdge).toMatchObject({
      direction: "UNDIRECTED",
      name: "형제",
      presentation: { strokeStyle: "dashed" },
      routing: { type: "straight" },
      version: 2,
    });
  });

  it("deletes a Node with incident Edges and restores exact V2 identities and versions", async () => {
    const workspace = await createWorkspace("Restore V2 Owner");
    const story = await createStory(workspace.id, "Restore V2 Story");
    const repository = new DrizzleGraphRepository();
    const createdBoard = await createBoardFixture(repository, story.id, "Main");
    const source = await repository.createNode(
      makeNode(createdBoard.id, "Source", {
        kind: "person",
        properties: { 직업: "마법사" },
      }),
    );
    const target = await repository.createNode(makeNode(createdBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(createdBoard.id, source.id, target.id, "친구", {
        routing: { ...edgeRouting, type: "curved" },
      }),
    );
    const updatedSource = await repository.updateNode({
      boardId: createdBoard.id,
      id: source.id,
      expectedVersion: source.version,
      x: 44,
    });
    expect(updatedSource).not.toBeNull();

    const deleted = await repository.deleteNode(createdBoard.id, source.id);
    expect(deleted?.edges.map((item) => item.id)).toEqual([edge.id]);
    await expect(repository.findEdge(createdBoard.id, edge.id)).resolves.toBeNull();

    const restored = await repository.restoreNode({
      boardId: createdBoard.id,
      node: restorableNode({
        id: deleted!.node.id,
        boardId: deleted!.node.boardId,
        name: deleted!.node.name,
        description: deleted!.node.description,
        kind: deleted!.node.kind,
        iconKey: deleted!.node.iconKey,
        properties: deleted!.node.properties,
        x: deleted!.node.x,
        y: deleted!.node.y,
        width: deleted!.node.width,
        height: deleted!.node.height,
        zIndex: deleted!.node.zIndex,
        presentation: deleted!.node.presentation,
        version: deleted!.node.version,
      }),
      edges: deleted!.edges.map((item) =>
        restorableEdge({
          id: item.id,
          boardId: item.boardId,
          sourceNodeId: item.sourceNodeId,
          targetNodeId: item.targetNodeId,
          direction: item.direction,
          name: item.name,
          description: item.description,
          kind: item.kind,
          iconKey: item.iconKey,
          properties: item.properties,
          presentation: item.presentation,
          routing: item.routing,
          version: item.version,
        }),
      ),
    });

    expect(restored?.node).toMatchObject({
      id: source.id,
      boardId: createdBoard.id,
      kind: "person",
      properties: { 직업: "마법사" },
      version: updatedSource!.version,
      x: 44,
    });
    expect(restored?.edges[0]).toMatchObject({
      id: edge.id,
      version: edge.version,
      routing: { type: "curved" },
    });
  });

  it("returns a direct Board snapshot and scopes lookup by Board id", async () => {
    const workspace = await createWorkspace("Snapshot V2 Owner");
    const story = await createStory(workspace.id, "Snapshot V2 Story");
    const repository = new DrizzleGraphRepository();
    const firstBoard = await createBoardFixture(repository, story.id, "A");
    const secondBoard = await createBoardFixture(repository, story.id, "B");
    const source = await repository.createNode(makeNode(firstBoard.id, "Source"));
    const target = await repository.createNode(makeNode(firstBoard.id, "Target"));
    const edge = await repository.createEdge(
      makeEdge(firstBoard.id, source.id, target.id, "connects"),
    );

    await expect(repository.getBoardSnapshot(firstBoard.id)).resolves.toEqual({
      board: firstBoard,
      nodes: [source, target],
      edges: [edge],
    });
    await expect(repository.findNode(secondBoard.id, source.id)).resolves.toBeNull();

    const rows = await db
      .select({ id: graphNode.id })
      .from(graphNode)
      .where(and(eq(graphNode.id, source.id), eq(graphNode.boardId, firstBoard.id)));
    expect(rows).toHaveLength(1);
  });
});
