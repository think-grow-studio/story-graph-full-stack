import { NextResponse } from "next/server";

import { ApplicationError } from "@/backend/common/errors/application-error";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import { ensurePersonalWorkspace } from "@/backend/modules/workspace/application/ensure-personal-workspace/ensure-personal-workspace";
import { BetterAuthWorkspaceProvisioner } from "@/backend/modules/workspace/infrastructure/better-auth-workspace-provisioner";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";
import { bootstrapResponseSchema } from "@/contracts/auth/bootstrap.contract";
import { identityDependencies } from "../_shared/identity-dependencies";

const workspaceAccess = new DrizzleWorkspaceAccessService();
const workspaceProvisioner = new BetterAuthWorkspaceProvisioner();

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const workspace = await ensurePersonalWorkspace(
      { userId: actor.id, userName: actor.name },
      { access: workspaceAccess, provisioner: workspaceProvisioner },
    );

    return NextResponse.json(
      bootstrapResponseSchema.parse({ actor, workspace }),
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    throw error;
  }
}
