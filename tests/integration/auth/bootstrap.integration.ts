import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/v1/bootstrap/route";
import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";
import { createTestIdentity } from "../../helpers/test-auth";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

async function createAuthenticatedRequest() {
  const identity = await createTestIdentity("Bootstrap User");
  createdUserIds.push(identity.user.id);

  return {
    user: identity.user,
    request: new Request("http://localhost/api/v1/bootstrap", {
      headers: identity.headers,
    }),
  };
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }

  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("GET /api/v1/bootstrap", () => {
  it("returns 401 without a session cookie", async () => {
    const response = await GET(new Request("http://localhost/api/v1/bootstrap"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns the current actor and an idempotent personal workspace", async () => {
    const { request, user: signedUpUser } = await createAuthenticatedRequest();

    const firstResponse = await GET(request);
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json();
    createdOrganizationIds.push(first.workspace.id);

    expect(first).toMatchObject({
      actor: {
        id: signedUpUser.id,
        email: signedUpUser.email,
        name: signedUpUser.name,
      },
      workspace: {
        name: "Bootstrap User's Workspace",
      },
    });

    const secondResponse = await GET(request);
    expect(secondResponse.status).toBe(200);
    const second = await secondResponse.json();

    expect(second.workspace.id).toBe(first.workspace.id);
  });
});
