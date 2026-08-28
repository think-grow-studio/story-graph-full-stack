import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as BOOTSTRAP } from "@/app/api/v1/bootstrap/route";
import { GET as GET_SNAPSHOT } from "@/app/api/v1/boards/[boardId]/snapshot/route";
import { POST as CREATE_NODE } from "@/app/api/v1/boards/[boardId]/nodes/route";
import { POST as CREATE_STORY } from "@/app/api/v1/stories/route";
import { POST as CREATE_BOARD } from "@/app/api/v1/stories/[storyId]/boards/route";
import { db } from "@/backend/infrastructure/database/client";
import {
  member,
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

  return {
    userId: identity.user.id,
    cookie: identity.cookie,
    workspaceId: bootstrap.workspace.id as string,
  };
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

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("Graph Core API capability enforcement", () => {
  it("allows a member to read a Board but returns 403 for graph writes", async () => {
    const owner = await createSession("Graph Capability Owner");
    const reader = await createSession("Graph Capability Member");

    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: owner.workspaceId,
      userId: reader.userId,
      role: "member",
      createdAt: new Date(),
    });

    const storyResponse = await CREATE_STORY(
      request("http://localhost/api/v1/stories", {
        method: "POST",
        cookie: owner.cookie,
        body: { workspaceId: owner.workspaceId, name: "Capability Story" },
      }),
    );
    expect(storyResponse.status).toBe(201);
    const story = await storyResponse.json();

    const boardResponse = await CREATE_BOARD(
      request(`http://localhost/api/v1/stories/${story.id}/boards`, {
        method: "POST",
        cookie: owner.cookie,
        body: { workspaceId: owner.workspaceId, name: "Main" },
      }),
      storyContext(story.id),
    );
    expect(boardResponse.status).toBe(201);
    const board = await boardResponse.json();

    const readResponse = await GET_SNAPSHOT(
      request(
        `http://localhost/api/v1/boards/${board.id}/snapshot?workspaceId=${owner.workspaceId}`,
        { cookie: reader.cookie },
      ),
      boardContext(board.id),
    );
    expect(readResponse.status).toBe(200);

    const writeResponse = await CREATE_NODE(
      request(`http://localhost/api/v1/boards/${board.id}/nodes`, {
        method: "POST",
        cookie: reader.cookie,
        body: {
          workspaceId: owner.workspaceId,
          id: crypto.randomUUID(),
          name: "Forbidden Node",
          position: { x: 0, y: 0 },
        },
      }),
      boardContext(board.id),
    );

    expect(writeResponse.status).toBe(403);
    await expect(writeResponse.json()).resolves.toMatchObject({ code: "FORBIDDEN" });
  });
});
