import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { auth } from "@/backend/infrastructure/auth/auth";
import { db } from "@/backend/infrastructure/database/client";
import { member, organization, user } from "@/backend/infrastructure/database/schema";
import { ensurePersonalWorkspace } from "@/backend/modules/workspace/application/ensure-personal-workspace/ensure-personal-workspace";
import { BetterAuthWorkspaceProvisioner } from "@/backend/modules/workspace/infrastructure/better-auth-workspace-provisioner";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

async function createUser(name: string) {
  const response = await auth.api.signUpEmail({
    body: {
      email: `workspace-integration-${crypto.randomUUID()}@example.com`,
      password: "password1234",
      name,
    },
  });

  createdUserIds.push(response.user.id);
  return response.user;
}

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }

  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("personal workspace provisioning", () => {
  it("is idempotent and creates one owner membership", async () => {
    const owner = await createUser("Workspace Owner");
    const access = new DrizzleWorkspaceAccessService();
    const provisioner = new BetterAuthWorkspaceProvisioner();

    const first = await ensurePersonalWorkspace(
      { userId: owner.id, userName: owner.name },
      { access, provisioner },
    );
    createdOrganizationIds.push(first.id);

    const second = await ensurePersonalWorkspace(
      { userId: owner.id, userName: owner.name },
      { access, provisioner },
    );

    const organizations = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, first.slug));
    const memberships = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, first.id),
          eq(member.userId, owner.id),
        ),
      );

    expect(second.id).toBe(first.id);
    expect(organizations).toHaveLength(1);
    expect(memberships).toEqual([{ role: "owner" }]);
  });
});

describe("workspace authorization", () => {
  it("allows owners, rejects unrelated users, and keeps members read-only", async () => {
    const owner = await createUser("Owner");
    const unrelated = await createUser("Unrelated");
    const reader = await createUser("Reader");
    const access = new DrizzleWorkspaceAccessService();
    const provisioner = new BetterAuthWorkspaceProvisioner();

    const workspace = await ensurePersonalWorkspace(
      { userId: owner.id, userName: owner.name },
      { access, provisioner },
    );
    createdOrganizationIds.push(workspace.id);

    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: workspace.id,
      userId: reader.id,
      role: "member",
      createdAt: new Date(),
    });

    await expect(
      access.requireCapability({
        userId: owner.id,
        workspaceId: workspace.id,
        capability: "story:update",
      }),
    ).resolves.toBeUndefined();

    await expect(
      access.requireCapability({
        userId: unrelated.id,
        workspaceId: workspace.id,
        capability: "story:read",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    await expect(
      access.requireCapability({
        userId: reader.id,
        workspaceId: workspace.id,
        capability: "story:read",
      }),
    ).resolves.toBeUndefined();

    await expect(
      access.requireCapability({
        userId: reader.id,
        workspaceId: workspace.id,
        capability: "story:update",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
