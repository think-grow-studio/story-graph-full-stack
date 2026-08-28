import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { db } from "@/backend/infrastructure/database/client";
import { organization, user } from "@/backend/infrastructure/database/schema";
import type { Story } from "@/backend/modules/story/domain/story";
import { DrizzleStoryRepository } from "@/backend/modules/story/infrastructure/drizzle-story.repository";
import { ensurePersonalWorkspace } from "@/backend/modules/workspace/application/ensure-personal-workspace/ensure-personal-workspace";
import { BetterAuthWorkspaceProvisioner } from "@/backend/modules/workspace/infrastructure/better-auth-workspace-provisioner";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";
import { createTestIdentity } from "../../helpers/test-auth";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];

async function createWorkspace() {
  const identity = await createTestIdentity("Story Owner");
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

afterEach(async () => {
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("DrizzleStoryRepository", () => {
  it("creates, filters, updates, and deletes Stories", async () => {
    const firstWorkspace = await createWorkspace();
    const secondWorkspace = await createWorkspace();
    const repository = new DrizzleStoryRepository();
    const now = new Date();

    const first: Story = {
      id: crypto.randomUUID(),
      workspaceId: firstWorkspace.id,
      name: "First",
      description: "One",
      createdAt: now,
      updatedAt: now,
    };
    const second: Story = {
      ...first,
      id: crypto.randomUUID(),
      workspaceId: secondWorkspace.id,
      name: "Second",
    };

    await repository.create(first);
    await repository.create(second);

    await expect(repository.findById(first.id)).resolves.toMatchObject({
      id: first.id,
      workspaceId: firstWorkspace.id,
      name: "First",
    });
    await expect(repository.listByWorkspace(firstWorkspace.id)).resolves.toEqual([
      expect.objectContaining({ id: first.id }),
    ]);

    const updated = await repository.update({ id: first.id, name: "Renamed" });
    expect(updated).toMatchObject({ id: first.id, name: "Renamed", description: "One" });
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());

    await expect(repository.delete(first.id)).resolves.toBe(true);
    await expect(repository.delete(first.id)).resolves.toBe(false);
    await expect(repository.findById(first.id)).resolves.toBeNull();
  });

  it("enforces the workspace foreign key", async () => {
    const repository = new DrizzleStoryRepository();
    const now = new Date();

    await expect(
      repository.create({
        id: crypto.randomUUID(),
        workspaceId: "missing-workspace",
        name: "Invalid",
        description: "",
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toBeTruthy();
  });
});
