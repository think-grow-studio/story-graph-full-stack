import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as BOOTSTRAP } from "@/app/api/v1/bootstrap/route";
import { GET as GET_SNAPSHOT } from "@/app/api/v1/boards/[boardId]/snapshot/route";
import { POST as CREATE_STORY } from "@/app/api/v1/stories/route";
import { POST as CREATE_BOARD } from "@/app/api/v1/stories/[storyId]/boards/route";
import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";
import { createTestIdentity } from "../../helpers/test-auth";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

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

describe("Graph snapshot HTTP contract", () => {
  it("returns Story and Board snapshot fields at the top level", async () => {
    const identity = await createTestIdentity("Snapshot Contract Owner");
    createdUserIds.push(identity.user.id);

    const bootstrapResponse = await BOOTSTRAP(
      new Request("http://localhost/api/v1/bootstrap", { headers: identity.headers }),
    );
    expect(bootstrapResponse.status).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;
    createdOrganizationIds.push(workspaceId);

    const storyResponse = await CREATE_STORY(
      request("http://localhost/api/v1/stories", {
        method: "POST",
        cookie: identity.cookie,
        body: { workspaceId, name: "Snapshot Contract Story" },
      }),
    );
    expect(storyResponse.status).toBe(201);
    const story = await storyResponse.json();

    const boardResponse = await CREATE_BOARD(
      request(`http://localhost/api/v1/stories/${story.id}/boards`, {
        method: "POST",
        cookie: identity.cookie,
        body: { workspaceId, name: "Main" },
      }),
      storyContext(story.id),
    );
    expect(boardResponse.status).toBe(201);
    const board = await boardResponse.json();

    const snapshotResponse = await GET_SNAPSHOT(
      request(
        `http://localhost/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
        { cookie: identity.cookie },
      ),
      boardContext(board.id),
    );
    expect(snapshotResponse.status).toBe(200);

    const payload = await snapshotResponse.json();
    expect(payload).toMatchObject({
      story: { id: story.id, name: "Snapshot Contract Story" },
      board: { id: board.id, storyId: story.id, name: "Main" },
      nodes: [],
      edges: [],
      boardNodes: [],
      boardEdges: [],
    });
    expect(payload.snapshot).toBeUndefined();
  });
});
