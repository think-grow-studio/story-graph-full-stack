import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as BOOTSTRAP } from "@/app/api/v1/bootstrap/route";
import { POST as CREATE_STORY } from "@/app/api/v1/stories/route";
import {
  GET as LIST_BOARDS,
  POST as CREATE_BOARD,
} from "@/app/api/v1/stories/[storyId]/boards/route";
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

async function createStory(cookie: string, workspaceId: string) {
  const response = await CREATE_STORY(
    request("http://localhost/api/v1/stories", {
      method: "POST",
      cookie,
      body: { workspaceId, name: "Board List Story" },
    }),
  );
  expect(response.status).toBe(201);
  return response.json();
}

async function createBoard(
  cookie: string,
  workspaceId: string,
  storyId: string,
  name: string,
) {
  const response = await CREATE_BOARD(
    request(`http://localhost/api/v1/stories/${storyId}/boards`, {
      method: "POST",
      cookie,
      body: { workspaceId, name },
    }),
    storyContext(storyId),
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

describe("Board list API", () => {
  it("lists only Boards belonging to the requested Story", async () => {
    const { cookie, workspaceId } = await createSession("Board List Owner");
    const story = await createStory(cookie, workspaceId);
    const first = await createBoard(cookie, workspaceId, story.id, "World");
    const second = await createBoard(cookie, workspaceId, story.id, "Characters");

    const response = await LIST_BOARDS(
      request(
        `http://localhost/api/v1/stories/${story.id}/boards?workspaceId=${workspaceId}`,
        { cookie },
      ),
      storyContext(story.id),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      boards: [
        expect.objectContaining({ id: first.id, storyId: story.id, name: "World" }),
        expect.objectContaining({ id: second.id, storyId: story.id, name: "Characters" }),
      ],
    });
  });

  it("returns 404 when the Story is addressed through another workspace", async () => {
    const owner = await createSession("Board List Owner Workspace");
    const outsider = await createSession("Board List Outsider Workspace");
    const story = await createStory(owner.cookie, owner.workspaceId);
    await createBoard(owner.cookie, owner.workspaceId, story.id, "Hidden Board");

    const response = await LIST_BOARDS(
      request(
        `http://localhost/api/v1/stories/${story.id}/boards?workspaceId=${outsider.workspaceId}`,
        { cookie: outsider.cookie },
      ),
      storyContext(story.id),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
  });
});
