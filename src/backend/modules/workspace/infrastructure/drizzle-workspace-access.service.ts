import "server-only";

import { and, eq } from "drizzle-orm";

import { ApplicationError } from "@/backend/common/errors/application-error";
import { db } from "@/backend/infrastructure/database/client";
import { member, organization } from "@/backend/infrastructure/database/schema";
import { personalWorkspaceSlug } from "../domain/personal-workspace";
import type {
  WorkspaceAccessService,
  WorkspaceCapability,
  WorkspaceSummary,
} from "../domain/workspace-access.service";

const fullStoryCapabilities = new Set<WorkspaceCapability>([
  "story:read",
  "story:create",
  "story:update",
  "story:delete",
]);

export function workspaceRoleHasCapability(
  roleValue: string,
  capability: WorkspaceCapability,
): boolean {
  const roles = roleValue
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (roles.some((role) => role === "owner" || role === "admin")) {
    return fullStoryCapabilities.has(capability);
  }

  return roles.includes("member") && capability === "story:read";
}

export class DrizzleWorkspaceAccessService implements WorkspaceAccessService {
  async findPersonalWorkspace(userId: string): Promise<WorkspaceSummary | null> {
    const [row] = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(
        and(
          eq(member.userId, userId),
          eq(organization.slug, personalWorkspaceSlug(userId)),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async requireCapability(input: {
    userId: string;
    workspaceId: string;
    capability: WorkspaceCapability;
  }): Promise<void> {
    const [membership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, input.userId),
          eq(member.organizationId, input.workspaceId),
        ),
      )
      .limit(1);

    if (!membership || !workspaceRoleHasCapability(membership.role, input.capability)) {
      throw new ApplicationError("FORBIDDEN", 403);
    }
  }
}
