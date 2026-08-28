import "server-only";

import { auth } from "@/backend/infrastructure/auth/auth";
import type { WorkspaceProvisioner } from "../application/ensure-personal-workspace/ensure-personal-workspace";

export class BetterAuthWorkspaceProvisioner implements WorkspaceProvisioner {
  async createPersonalWorkspace(input: {
    userId: string;
    name: string;
    slug: string;
  }) {
    const workspace = await auth.api.createOrganization({
      body: {
        userId: input.userId,
        name: input.name,
        slug: input.slug,
      },
    });

    if (!workspace) {
      throw new Error("Better Auth did not create a workspace");
    }

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    };
  }
}
