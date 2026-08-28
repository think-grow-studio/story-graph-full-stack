import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DELETE, GET as GET_STORY, PATCH } from "@/app/api/v1/stories/[storyId]/route";
import { GET as LIST_STORIES, POST } from "@/app/api/v1/stories/route";
import { GET as BOOTSTRAP } from "@/app/api/v1/bootstrap/route";
import { auth } from "@/backend/infrastructure/auth/auth";
import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

async function createSession(name: string) {
  const result = await auth.api.signUpEmail({
    returnHeaders: true,
    body: {
      email: `story-api-${crypto.randomUUID()}@example.com`,
      password: "Password123!",
      name,
    },
  });
  createdUserIds.push(result.response.user.id);

  const cookie = result.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");

  const bootstrapResponse = await BOOTSTRAP(
    new Request("http://localhost/api/v1/bootstrap", { headers: { cookie } }),
  );
  const bootstrap = await bootstrapResponse.json();
  createdOrganizationIds.push(bootstrap.workspace.id);

  return { cookie, workspaceId: bootstrap.workspace.id };
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

function storyContext(storyId: string) {
  return { params: Promise.resolve({ storyId }) };
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("/api/v1/stories", () => {
  it("requires authentication", async () => {
    const response = await POST(
      request("http://localhost/api/v1/stories", {
        method: "POST",
        body: { workspaceId: crypto.randomUUID(), name: "Private Story" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates, lists, reads, updates, and deletes a Story", async () => {
    const { cookie, workspaceId } = await createSession("Story Owner");

    const createResponse = await POST(
      request("http://localhost/api/v1/stories", {
        method: "POST",
        cookie,
        body: {
          workspaceId,
          name: "First Story",
          description: "First description",
        },
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created).toMatchObject({ workspaceId, name: "First Story", description: "First description" });
    expect(typeof created.createdAt).toBe("string");

    const listResponse = await LIST_STORIES(
      request(`http://localhost/api/v1/stories?workspaceId=${workspaceId}`, { cookie }),
    );
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      stories: [{ id: created.id, name: "First Story" }],
    });

    const getResponse = await GET_STORY(
      request(`http://localhost/api/v1/stories/${created.id}?workspaceId=${workspaceId}`, { cookie }),
      storyContext(created.id),
    );
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({ id: created.id, name: "First Story" });

    const patchResponse = await PATCH(
      request(`http://localhost/api/v1/stories/${created.id}`, {
        method: "PATCH",
        cookie,
        body: { workspaceId, name: "Renamed Story" },
      }),
      storyContext(created.id),
    );
    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      id: created.id,
      name: "Renamed Story",
      description: "First description",
    });

    const deleteResponse = await DELETE(
      request(`http://localhost/api/v1/stories/${created.id}?workspaceId=${workspaceId}`, {
        method: "DELETE",
        cookie,
      }),
      storyContext(created.id),
    );
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await GET_STORY(
      request(`http://localhost/api/v1/stories/${created.id}?workspaceId=${workspaceId}`, { cookie }),
      storyContext(created.id),
    );
    expect(missingResponse.status).toBe(404);
  });

  it("returns 404 when a Story is addressed through another workspace", async () => {
    const owner = await createSession("Owner");
    const outsider = await createSession("Outsider");

    const createResponse = await POST(
      request("http://localhost/api/v1/stories", {
        method: "POST",
        cookie: owner.cookie,
        body: { workspaceId: owner.workspaceId, name: "Hidden Story" },
      }),
    );
    const created = await createResponse.json();

    const response = await GET_STORY(
      request(
        `http://localhost/api/v1/stories/${created.id}?workspaceId=${outsider.workspaceId}`,
        { cookie: outsider.cookie },
      ),
      storyContext(created.id),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "NOT_FOUND" });
  });
});
