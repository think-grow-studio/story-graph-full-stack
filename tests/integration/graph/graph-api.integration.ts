import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as BOOTSTRAP } from "@/app/api/v1/bootstrap/route";
import { POST as CREATE_STORY } from "@/app/api/v1/stories/route";
import { POST as CREATE_BOARD } from "@/app/api/v1/stories/[storyId]/boards/route";
import { PATCH as UPDATE_BOARD } from "@/app/api/v1/boards/[boardId]/route";
import { GET as GET_SNAPSHOT } from "@/app/api/v1/boards/[boardId]/snapshot/route";
import { POST as CREATE_NODE } from "@/app/api/v1/boards/[boardId]/nodes/route";
import {
  DELETE as DELETE_NODE,
  PATCH as UPDATE_NODE,
} from "@/app/api/v1/boards/[boardId]/nodes/[nodeId]/route";
import { POST as RESTORE_NODE } from "@/app/api/v1/boards/[boardId]/nodes/[nodeId]/restore/route";
import { POST as CREATE_EDGE } from "@/app/api/v1/boards/[boardId]/edges/route";
import {
  DELETE as DELETE_EDGE,
  PATCH as UPDATE_EDGE,
} from "@/app/api/v1/boards/[boardId]/edges/[edgeId]/route";
import { POST as RESTORE_EDGE } from "@/app/api/v1/boards/[boardId]/edges/[edgeId]/restore/route";
import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";
import type { GraphEdgeResponse, GraphNodeResponse } from "@/contracts/graph/graph.contract";
import { createTestIdentity } from "../../helpers/test-auth";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

const defaultNodePresentation = {
  shape: "rounded-rect" as const,
  fillColor: null,
  borderColor: null,
  borderWidth: null,
  textColor: null,
};

const defaultEdgePresentation = {
  strokeColor: null,
  strokeWidth: null,
  strokeStyle: "solid" as const,
  labelColor: null,
};

const defaultEdgeRouting = {
  type: "orthogonal" as const,
  sourcePort: "auto" as const,
  targetPort: "auto" as const,
  waypoints: [],
};

async function createSession(name: string) {
  const identity = await createTestIdentity(name);
  createdUserIds.push(identity.user.id);
  const response = await BOOTSTRAP(
    new Request("http://localhost/api/v1/bootstrap", { headers: identity.headers }),
  );
  const bootstrap = await response.json();
  createdOrganizationIds.push(bootstrap.workspace.id);
  return { cookie: identity.cookie, workspaceId: bootstrap.workspace.id as string };
}

function request(
  url: string,
  options: { cookie?: string; method?: string; body?: unknown } = {},
) {
  return new Request(url, {
    method: options.method,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

const storyContext = (storyId: string) => ({ params: Promise.resolve({ storyId }) });
const boardContext = (boardId: string) => ({ params: Promise.resolve({ boardId }) });
const boardNodeContext = (boardId: string, nodeId: string) => ({
  params: Promise.resolve({ boardId, nodeId }),
});
const boardEdgeContext = (boardId: string, edgeId: string) => ({
  params: Promise.resolve({ boardId, edgeId }),
});

async function createStory(cookie: string, workspaceId: string, name = "Graph Story") {
  const response = await CREATE_STORY(
    request("http://localhost/api/v1/stories", {
      method: "POST",
      cookie,
      body: { workspaceId, name },
    }),
  );
  expect(response.status).toBe(201);
  return response.json();
}

async function createBoard(
  cookie: string,
  workspaceId: string,
  storyId: string,
  name = "Main",
  tags: string[] = [],
) {
  const response = await CREATE_BOARD(
    request(`http://localhost/api/v1/stories/${storyId}/boards`, {
      method: "POST",
      cookie,
      body: { workspaceId, name, tags },
    }),
    storyContext(storyId),
  );
  expect(response.status).toBe(201);
  return response.json();
}

async function createNode(
  cookie: string,
  workspaceId: string,
  boardId: string,
  name: string,
  x = 10,
  y = 20,
  overrides: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  const response = await CREATE_NODE(
    request(`http://localhost/api/v1/boards/${boardId}/nodes`, {
      method: "POST",
      cookie,
      body: {
        workspaceId,
        id,
        name,
        description: "",
        kind: "entity",
        iconKey: null,
        properties: {},
        x,
        y,
        width: null,
        height: null,
        zIndex: 0,
        presentation: defaultNodePresentation,
        ...overrides,
      },
    }),
    boardContext(boardId),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as GraphNodeResponse;
}

async function createEdge(
  cookie: string,
  workspaceId: string,
  boardId: string,
  sourceNodeId: string,
  targetNodeId: string,
  name = "knows",
  overrides: Record<string, unknown> = {},
) {
  const id = crypto.randomUUID();
  const response = await CREATE_EDGE(
    request(`http://localhost/api/v1/boards/${boardId}/edges`, {
      method: "POST",
      cookie,
      body: {
        workspaceId,
        id,
        sourceNodeId,
        targetNodeId,
        direction: "DIRECTED",
        name,
        description: "",
        kind: "relationship",
        iconKey: null,
        properties: {},
        presentation: defaultEdgePresentation,
        routing: defaultEdgeRouting,
        ...overrides,
      },
    }),
    boardContext(boardId),
  );
  expect(response.status).toBe(201);
  return (await response.json()) as GraphEdgeResponse;
}

function restorableNode(node: GraphNodeResponse) {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = node;
  return rest;
}

function restorableEdge(edge: GraphEdgeResponse) {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = edge;
  return rest;
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("Board-owned Graph API", () => {
  it("requires authentication and validates V2 Node input at the HTTP boundary", async () => {
    const unauthenticated = await CREATE_BOARD(
      request(`http://localhost/api/v1/stories/${crypto.randomUUID()}/boards`, {
        method: "POST",
        body: { workspaceId: "workspace-1", name: "Private" },
      }),
      storyContext(crypto.randomUUID()),
    );
    expect(unauthenticated.status).toBe(401);

    const { cookie, workspaceId } = await createSession("Graph Validation Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    const invalidId = await CREATE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes`, {
        method: "POST",
        cookie,
        body: { workspaceId, id: "not-a-uuid", name: "Invalid", x: 0, y: 0 },
      }),
      boardContext(board.id),
    );
    expect(invalidId.status).toBe(400);

    const invalidProperties = await CREATE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes`, {
        method: "POST",
        cookie,
        body: {
          workspaceId,
          id: crypto.randomUUID(),
          name: "Invalid properties",
          x: 0,
          y: 0,
          properties: { age: 20 },
        },
      }),
      boardContext(board.id),
    );
    expect(invalidProperties.status).toBe(400);
  });

  it("updates Board metadata, tags, graph settings and keeps same-named Nodes independent across Boards", async () => {
    const { cookie, workspaceId } = await createSession("Board Isolation Owner");
    const story = await createStory(cookie, workspaceId);
    const firstBoard = await createBoard(cookie, workspaceId, story.id, "Characters", ["인물"]);
    const secondBoard = await createBoard(cookie, workspaceId, story.id, "Timeline", ["사건"]);

    const boardUpdate = await UPDATE_BOARD(
      request(`http://localhost/api/v1/boards/${firstBoard.id}`, {
        method: "PATCH",
        cookie,
        body: {
          workspaceId,
          name: "Main Characters",
          description: "Primary cast",
          tags: ["인물", "핵심"],
          graphSettings: {
            defaultEdgeRouting: "curved",
            snapToGrid: true,
            layoutMode: "free",
          },
        },
      }),
      boardContext(firstBoard.id),
    );
    expect(boardUpdate.status).toBe(200);
    await expect(boardUpdate.json()).resolves.toMatchObject({
      name: "Main Characters",
      tags: ["인물", "핵심"],
      graphSettings: {
        defaultEdgeRouting: "curved",
        snapToGrid: true,
        layoutMode: "free",
      },
    });

    const firstAlice = await createNode(cookie, workspaceId, firstBoard.id, "Alice", 100, 80);
    const secondAlice = await createNode(cookie, workspaceId, secondBoard.id, "Alice", 400, 300);

    const rename = await UPDATE_NODE(
      request(`http://localhost/api/v1/boards/${firstBoard.id}/nodes/${firstAlice.id}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, expectedVersion: firstAlice.version, name: "Alicia", x: 150 },
      }),
      boardNodeContext(firstBoard.id, firstAlice.id),
    );
    expect(rename.status).toBe(200);
    await expect(rename.json()).resolves.toMatchObject({ name: "Alicia", x: 150, version: 2 });

    const firstSnapshot = await GET_SNAPSHOT(
      request(
        `http://localhost/api/v1/boards/${firstBoard.id}/snapshot?workspaceId=${workspaceId}`,
        { cookie },
      ),
      boardContext(firstBoard.id),
    );
    const secondSnapshot = await GET_SNAPSHOT(
      request(
        `http://localhost/api/v1/boards/${secondBoard.id}/snapshot?workspaceId=${workspaceId}`,
        { cookie },
      ),
      boardContext(secondBoard.id),
    );
    await expect(firstSnapshot.json()).resolves.toMatchObject({
      board: {
        graphSettings: {
          defaultEdgeRouting: "curved",
          snapToGrid: true,
          layoutMode: "free",
        },
      },
      nodes: [expect.objectContaining({ id: firstAlice.id, name: "Alicia", x: 150 })],
    });
    await expect(secondSnapshot.json()).resolves.toMatchObject({
      nodes: [expect.objectContaining({ id: secondAlice.id, name: "Alice", x: 400 })],
    });
  });

  it("round-trips V2 Node and Edge semantics, presentation, routing, and opposite relationships", async () => {
    const { cookie, workspaceId } = await createSession("Graph V2 Round Trip Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    const source = await createNode(cookie, workspaceId, board.id, "Alice", 40, 60, {
      kind: "person",
      properties: {
        profile: {
          age: "20",
          aliases: ["A", "Leader"],
        },
      },
      presentation: {
        shape: "ellipse",
        fillColor: "#fff",
        borderColor: "#111",
        borderWidth: 2,
        textColor: "#222",
      },
    });
    const target = await createNode(cookie, workspaceId, board.id, "Bob", 240, 60);

    expect(source).toMatchObject({
      kind: "person",
      properties: { profile: { age: "20", aliases: ["A", "Leader"] } },
      presentation: {
        shape: "ellipse",
        fillColor: "#fff",
        borderColor: "#111",
        borderWidth: 2,
        textColor: "#222",
      },
    });

    const forward = await createEdge(
      cookie,
      workspaceId,
      board.id,
      source.id,
      target.id,
      "protects",
      {
        direction: "DIRECTED",
        kind: "protection",
        properties: { since: "2024" },
        presentation: {
          strokeColor: "#333",
          strokeWidth: 2,
          strokeStyle: "dashed",
          labelColor: "#111",
        },
        routing: {
          type: "curved",
          sourcePort: "right",
          targetPort: "left",
          waypoints: [{ x: 140, y: 90 }],
        },
      },
    );
    const reverse = await createEdge(
      cookie,
      workspaceId,
      board.id,
      target.id,
      source.id,
      "distrusts",
      {
        direction: "DIRECTED",
        kind: "distrust",
      },
    );

    expect(forward).toMatchObject({
      direction: "DIRECTED",
      kind: "protection",
      properties: { since: "2024" },
      presentation: {
        strokeColor: "#333",
        strokeWidth: 2,
        strokeStyle: "dashed",
        labelColor: "#111",
      },
      routing: {
        type: "curved",
        sourcePort: "right",
        targetPort: "left",
        waypoints: [{ x: 140, y: 90 }],
      },
    });
    expect(reverse).toMatchObject({
      sourceNodeId: target.id,
      targetNodeId: source.id,
      direction: "DIRECTED",
      name: "distrusts",
    });

    const nodeUpdate = await UPDATE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes/${source.id}`, {
        method: "PATCH",
        cookie,
        body: {
          workspaceId,
          expectedVersion: source.version,
          kind: "character",
          properties: { role: "lead" },
          presentation: {
            shape: "diamond",
            fillColor: null,
            borderColor: null,
            borderWidth: 3,
            textColor: null,
          },
        },
      }),
      boardNodeContext(board.id, source.id),
    );
    expect(nodeUpdate.status).toBe(200);
    await expect(nodeUpdate.json()).resolves.toMatchObject({
      kind: "character",
      properties: { role: "lead" },
      presentation: {
        shape: "diamond",
        borderWidth: 3,
      },
      version: source.version + 1,
    });

    const edgeUpdate = await UPDATE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges/${forward.id}`, {
        method: "PATCH",
        cookie,
        body: {
          workspaceId,
          expectedVersion: forward.version,
          direction: "UNDIRECTED",
          kind: "bond",
          presentation: {
            strokeColor: null,
            strokeWidth: 3,
            strokeStyle: "dotted",
            labelColor: null,
          },
          routing: {
            type: "straight",
            sourcePort: "bottom",
            targetPort: "top",
            waypoints: [],
          },
        },
      }),
      boardEdgeContext(board.id, forward.id),
    );
    expect(edgeUpdate.status).toBe(200);
    await expect(edgeUpdate.json()).resolves.toMatchObject({
      direction: "UNDIRECTED",
      kind: "bond",
      presentation: { strokeWidth: 3, strokeStyle: "dotted" },
      routing: {
        type: "straight",
        sourcePort: "bottom",
        targetPort: "top",
        waypoints: [],
      },
      version: forward.version + 1,
    });

    const snapshotResponse = await GET_SNAPSHOT(
      request(`http://localhost/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`, {
        cookie,
      }),
      boardContext(board.id),
    );
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: forward.id, direction: "UNDIRECTED", kind: "bond" }),
        expect.objectContaining({ id: reverse.id, direction: "DIRECTED", name: "distrusts" }),
      ]),
    );
  });

  it("uses Board-scoped Node/Edge CAS and returns 409 for stale V2 writes", async () => {
    const { cookie, workspaceId } = await createSession("Graph CAS Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    const source = await createNode(cookie, workspaceId, board.id, "Source");
    const target = await createNode(cookie, workspaceId, board.id, "Target", 100, 20);
    const edge = await createEdge(cookie, workspaceId, board.id, source.id, target.id);

    const nodeUpdate = await UPDATE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes/${source.id}`, {
        method: "PATCH",
        cookie,
        body: {
          workspaceId,
          expectedVersion: source.version,
          y: 99,
          presentation: {
            shape: "rounded-rect",
            fillColor: null,
            borderColor: null,
            borderWidth: 2,
            textColor: null,
          },
        },
      }),
      boardNodeContext(board.id, source.id),
    );
    expect(nodeUpdate.status).toBe(200);

    const staleNode = await UPDATE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes/${source.id}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, expectedVersion: source.version, kind: "stale" },
      }),
      boardNodeContext(board.id, source.id),
    );
    expect(staleNode.status).toBe(409);

    const edgeUpdate = await UPDATE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges/${edge.id}`, {
        method: "PATCH",
        cookie,
        body: {
          workspaceId,
          expectedVersion: edge.version,
          name: "protects",
          routing: {
            type: "curved",
            sourcePort: "auto",
            targetPort: "auto",
            waypoints: [],
          },
        },
      }),
      boardEdgeContext(board.id, edge.id),
    );
    expect(edgeUpdate.status).toBe(200);

    const staleEdge = await UPDATE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges/${edge.id}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, expectedVersion: edge.version, direction: "UNDIRECTED" },
      }),
      boardEdgeContext(board.id, edge.id),
    );
    expect(staleEdge.status).toBe(409);
  });

  it("deletes a Node with incident Edges and restores the same UUIDs/versions", async () => {
    const { cookie, workspaceId } = await createSession("Node Restore API Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    const source = await createNode(cookie, workspaceId, board.id, "Source");
    const target = await createNode(cookie, workspaceId, board.id, "Target");
    const edge = await createEdge(cookie, workspaceId, board.id, source.id, target.id);

    const remove = await DELETE_NODE(
      request(
        `http://localhost/api/v1/boards/${board.id}/nodes/${source.id}?workspaceId=${workspaceId}`,
        {
          method: "DELETE",
          cookie,
        },
      ),
      boardNodeContext(board.id, source.id),
    );
    expect(remove.status).toBe(204);

    const deletedSnapshotResponse = await GET_SNAPSHOT(
      request(`http://localhost/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`, {
        cookie,
      }),
      boardContext(board.id),
    );
    const deletedSnapshot = await deletedSnapshotResponse.json();
    expect(deletedSnapshot.nodes.map((item: GraphNodeResponse) => item.id)).not.toContain(source.id);
    expect(deletedSnapshot.edges.map((item: GraphEdgeResponse) => item.id)).not.toContain(edge.id);

    const restore = await RESTORE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes/${source.id}/restore`, {
        method: "POST",
        cookie,
        body: {
          workspaceId,
          node: restorableNode(source),
          edges: [restorableEdge(edge)],
        },
      }),
      boardNodeContext(board.id, source.id),
    );
    expect(restore.status).toBe(200);
    await expect(restore.json()).resolves.toMatchObject({
      node: { id: source.id, version: source.version },
      edges: [expect.objectContaining({ id: edge.id, version: edge.version })],
    });
  });

  it("deletes and restores an Edge with the same UUID/version", async () => {
    const { cookie, workspaceId } = await createSession("Edge Restore API Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    const source = await createNode(cookie, workspaceId, board.id, "Source");
    const target = await createNode(cookie, workspaceId, board.id, "Target");
    const edge = await createEdge(cookie, workspaceId, board.id, source.id, target.id);

    const remove = await DELETE_EDGE(
      request(
        `http://localhost/api/v1/boards/${board.id}/edges/${edge.id}?workspaceId=${workspaceId}`,
        {
          method: "DELETE",
          cookie,
        },
      ),
      boardEdgeContext(board.id, edge.id),
    );
    expect(remove.status).toBe(204);

    const restore = await RESTORE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges/${edge.id}/restore`, {
        method: "POST",
        cookie,
        body: { workspaceId, edge: restorableEdge(edge) },
      }),
      boardEdgeContext(board.id, edge.id),
    );
    expect(restore.status).toBe(200);
    await expect(restore.json()).resolves.toMatchObject({ id: edge.id, version: edge.version });
  });
});
