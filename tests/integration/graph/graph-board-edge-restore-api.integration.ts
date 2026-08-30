import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as BOOTSTRAP } from "@/app/api/v1/bootstrap/route";
import { POST as CREATE_STORY } from "@/app/api/v1/stories/route";
import { POST as CREATE_BOARD } from "@/app/api/v1/stories/[storyId]/boards/route";
import { POST as CREATE_NODE } from "@/app/api/v1/boards/[boardId]/nodes/route";
import { POST as CREATE_EDGE } from "@/app/api/v1/boards/[boardId]/edges/route";
import {
  DELETE as REMOVE_EDGE,
  PUT as RESTORE_EDGE,
} from "@/app/api/v1/boards/[boardId]/edges/[edgeId]/route";
import { GET as GET_SNAPSHOT } from "@/app/api/v1/boards/[boardId]/snapshot/route";
import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";
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
const boardEdgeContext = (boardId: string, edgeId: string) => ({
  params: Promise.resolve({ boardId, edgeId }),
});

async function createStory(cookie: string, workspaceId: string) {
  const response = await CREATE_STORY(
    request("http://localhost/api/v1/stories", {
      method: "POST",
      cookie,
      body: { workspaceId, name: "Restore API Story" },
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
) {
  const response = await CREATE_NODE(
    request(`http://localhost/api/v1/boards/${boardId}/nodes`, {
      method: "POST",
      cookie,
      body: { workspaceId, id, name, position: { x: 0, y: 0 } },
    }),
    boardContext(boardId),
  );
  expect(response.status).toBe(201);
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("PUT BoardEdge restore API", () => {
  it("restores an existing canonical Edge to a Board and is idempotent", async () => {
    const { cookie, workspaceId } = await createSession("Restore API Owner");
    const story = await createStory(cookie, workspaceId);
    const board = await createBoard(cookie, workspaceId, story.id);
    const sourceId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    await createNode(cookie, workspaceId, board.id, sourceId, "Source");
    await createNode(cookie, workspaceId, board.id, targetId, "Target");

    const edgeId = crypto.randomUUID();
    const createEdgeResponse = await CREATE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges`, {
        method: "POST",
        cookie,
        body: {
          workspaceId,
          id: edgeId,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          name: "knows",
        },
      }),
      boardContext(board.id),
    );
    expect(createEdgeResponse.status).toBe(201);

    const removeResponse = await REMOVE_EDGE(
      request(
        `http://localhost/api/v1/boards/${board.id}/edges/${edgeId}?workspaceId=${workspaceId}`,
        { method: "DELETE", cookie },
      ),
      boardEdgeContext(board.id, edgeId),
    );
    expect(removeResponse.status).toBe(204);

    const payload = {
      workspaceId,
      style: { stroke: "dashed" },
      labelPresentation: { hidden: false },
    };
    const firstResponse = await RESTORE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges/${edgeId}`, {
        method: "PUT",
        cookie,
        body: payload,
      }),
      boardEdgeContext(board.id, edgeId),
    );
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json();
    expect(first).toMatchObject({
      edge: { id: edgeId },
      boardEdge: {
        boardId: board.id,
        edgeId,
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
      },
    });

    const secondResponse = await RESTORE_EDGE(
      request(`http://localhost/api/v1/boards/${board.id}/edges/${edgeId}`, {
        method: "PUT",
        cookie,
        body: payload,
      }),
      boardEdgeContext(board.id, edgeId),
    );
    expect(secondResponse.status).toBe(200);
    await expect(secondResponse.json()).resolves.toEqual(first);

    const snapshotResponse = await GET_SNAPSHOT(
      request(
        `http://localhost/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
        { cookie },
      ),
      boardContext(board.id),
    );
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toEqual([expect.objectContaining({ id: edgeId })]);
    expect(snapshot.boardEdges).toEqual([
      expect.objectContaining({ edgeId, style: { stroke: "dashed" } }),
    ]);
  });
});
