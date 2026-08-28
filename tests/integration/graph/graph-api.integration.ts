import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as BOOTSTRAP } from "@/app/api/v1/bootstrap/route";
import { POST as CREATE_STORY } from "@/app/api/v1/stories/route";
import { POST as CREATE_BOARD } from "@/app/api/v1/stories/[storyId]/boards/route";
import { GET as GET_SNAPSHOT } from "@/app/api/v1/boards/[boardId]/snapshot/route";
import { POST as CREATE_NODE } from "@/app/api/v1/boards/[boardId]/nodes/route";
import {
  DELETE as REMOVE_NODE,
  PATCH as UPDATE_BOARD_NODE,
} from "@/app/api/v1/boards/[boardId]/nodes/[nodeId]/route";
import { PATCH as UPDATE_NODE } from "@/app/api/v1/nodes/[nodeId]/route";
import { POST as CREATE_EDGE } from "@/app/api/v1/boards/[boardId]/edges/route";
import { DELETE as REMOVE_EDGE } from "@/app/api/v1/boards/[boardId]/edges/[edgeId]/route";
import { PATCH as UPDATE_EDGE } from "@/app/api/v1/edges/[edgeId]/route";
import { db } from "@/backend/infrastructure/database/client";
import {
  graphEdge,
  graphNode,
  organization,
  user,
} from "@/backend/infrastructure/database/schema";
import { createTestIdentity } from "../../helpers/test-auth";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

async function createSession(name: string) {
  const identity = await createTestIdentity(name);
  createdUserIds.push(identity.user.id);
  const response = await BOOTSTRAP(
    new Request("http://localhost/api/v1/bootstrap", { headers: identity.headers }),
  );
  const bootstrap = await response.json();
  createdOrganizationIds.push(bootstrap.workspace.id);
  return { cookie: identity.cookie, workspaceId: bootstrap.workspace.id };
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
const nodeContext = (nodeId: string) => ({ params: Promise.resolve({ nodeId }) });
const boardNodeContext = (boardId: string, nodeId: string) => ({
  params: Promise.resolve({ boardId, nodeId }),
});
const edgeContext = (edgeId: string) => ({ params: Promise.resolve({ edgeId }) });
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

async function createBoard(cookie: string, workspaceId: string, storyId: string) {
  const response = await CREATE_BOARD(
    request(`http://localhost/api/v1/stories/${storyId}/boards`, {
      method: "POST",
      cookie,
      body: { workspaceId, name: "Main" },
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
  id: string,
  name: string,
  x = 10,
  y = 20,
) {
  const response = await CREATE_NODE(
    request(`http://localhost/api/v1/boards/${boardId}/nodes`, {
      method: "POST",
      cookie,
      body: { workspaceId, id, name, position: { x, y } },
    }),
    boardContext(boardId),
  );
  expect(response.status).toBe(201);
  return response.json();
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("Graph Core API", () => {
  it("requires authentication and validates graph input", async () => {
    const unauthenticated = await CREATE_BOARD(
      request(`http://localhost/api/v1/stories/${crypto.randomUUID()}/boards`, {
        method: "POST",
        body: { workspaceId: crypto.randomUUID(), name: "Private" },
      }),
      storyContext(crypto.randomUUID()),
    );
    expect(unauthenticated.status).toBe(401);

    const { cookie, workspaceId } = await createSession("Graph Validation Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);

    const invalidNode = await CREATE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes`, {
        method: "POST",
        cookie,
        body: {
          workspaceId,
          id: "not-a-uuid",
          name: "Invalid",
          position: { x: Number.POSITIVE_INFINITY, y: 0 },
          properties: [],
        },
      }),
      boardContext(board.id),
    );
    expect(invalidNode.status).toBe(400);
  });

  it("creates Board/Nodes, loads snapshot, updates placement and maps stale Node writes to 409", async () => {
    const { cookie, workspaceId } = await createSession("Graph Node Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    expect(board).toMatchObject({ storyId: story.id, revision: 0 });

    const nodeId = crypto.randomUUID();
    const created = await createNode(cookie, workspaceId, board.id, nodeId, "Alice", 120, 80);
    expect(created.node).toMatchObject({ id: nodeId, version: 1, name: "Alice" });
    expect(created.boardNode).toMatchObject({ nodeId, x: 120, y: 80 });

    const snapshotResponse = await GET_SNAPSHOT(
      request(`http://localhost/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`, { cookie }),
      boardContext(board.id),
    );
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.nodes).toEqual([expect.objectContaining({ id: nodeId })]);
    expect(snapshot.boardNodes).toEqual([
      expect.objectContaining({ nodeId, x: 120, y: 80 }),
    ]);

    const placementResponse = await UPDATE_BOARD_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes/${nodeId}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, x: 200, style: { selected: true } },
      }),
      boardNodeContext(board.id, nodeId),
    );
    expect(placementResponse.status).toBe(200);
    await expect(placementResponse.json()).resolves.toMatchObject({ x: 200 });

    const updateResponse = await UPDATE_NODE(
      request(`http://localhost/api/v1/nodes/${nodeId}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, version: 1, name: "Alice v2" },
      }),
      nodeContext(nodeId),
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({ version: 2, name: "Alice v2" });

    const staleResponse = await UPDATE_NODE(
      request(`http://localhost/api/v1/nodes/${nodeId}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, version: 1, description: "stale" },
      }),
      nodeContext(nodeId),
    );
    expect(staleResponse.status).toBe(409);
    await expect(staleResponse.json()).resolves.toMatchObject({ code: "CONFLICT" });
  });

  it("allows same-pair directed multi-edges, maps stale Edge writes to 409, and Board removal preserves canonical rows", async () => {
    const { cookie, workspaceId } = await createSession("Graph Edge Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    const sourceId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    await createNode(cookie, workspaceId, board.id, sourceId, "Source");
    await createNode(cookie, workspaceId, board.id, targetId, "Target", 100, 20);

    const edgeIds = [crypto.randomUUID(), crypto.randomUUID()];
    for (const [index, edgeId] of edgeIds.entries()) {
      const response = await CREATE_EDGE(
        request(`http://localhost/api/v1/boards/${board.id}/edges`, {
          method: "POST",
          cookie,
          body: {
            workspaceId,
            id: edgeId,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            name: index === 0 ? "trusts" : "protects",
          },
        }),
        boardContext(board.id),
      );
      expect(response.status).toBe(201);
    }

    const updateResponse = await UPDATE_EDGE(
      request(`http://localhost/api/v1/edges/${edgeIds[0]}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, version: 1, name: "strongly trusts" },
      }),
      edgeContext(edgeIds[0]),
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({ version: 2 });

    const staleResponse = await UPDATE_EDGE(
      request(`http://localhost/api/v1/edges/${edgeIds[0]}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, version: 1, description: "stale" },
      }),
      edgeContext(edgeIds[0]),
    );
    expect(staleResponse.status).toBe(409);

    const removeEdgeResponse = await REMOVE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges/${edgeIds[0]}?workspaceId=${workspaceId}`, {
        method: "DELETE",
        cookie,
      }),
      boardEdgeContext(board.id, edgeIds[0]),
    );
    expect(removeEdgeResponse.status).toBe(204);
    const [canonicalEdge] = await db.select().from(graphEdge).where(eq(graphEdge.id, edgeIds[0]));
    expect(canonicalEdge).toBeDefined();

    const removeNodeResponse = await REMOVE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes/${sourceId}?workspaceId=${workspaceId}`, {
        method: "DELETE",
        cookie,
      }),
      boardNodeContext(board.id, sourceId),
    );
    expect(removeNodeResponse.status).toBe(204);
    const [canonicalNode] = await db.select().from(graphNode).where(eq(graphNode.id, sourceId));
    expect(canonicalNode).toBeDefined();
  });

  it("returns 404 for cross-workspace graph addressing", async () => {
    const owner = await createSession("Graph API Owner");
    const outsider = await createSession("Graph API Outsider");
    const story = await createStory(owner.cookie, owner.workspaceId);
    const board = await createBoard(owner.cookie, owner.workspaceId, story.id);

    const response = await GET_SNAPSHOT(
      request(
        `http://localhost/api/v1/boards/${board.id}/snapshot?workspaceId=${outsider.workspaceId}`,
        { cookie: outsider.cookie },
      ),
      boardContext(board.id),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
  });
});
