import { NextResponse } from "next/server";

import { createScope } from "@/backend/modules/graph/application/create-scope/create-scope";
import { listScopes } from "@/backend/modules/graph/application/list-scopes/list-scopes";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  createScopeRequestSchema,
  graphIdSchema,
  listScopesResponseSchema,
  workspaceQuerySchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../_shared/graph-dependencies";
import { toScopeResponse } from "../../../_shared/graph-http";
import { identityDependencies } from "../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../_shared/route-error";

export async function GET(
  request: Request,
  context: { params: Promise<{ storyId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { storyId } = await context.params;
    const validatedStoryId = graphIdSchema.parse(storyId);
    const query = workspaceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const scopes = await listScopes(
      {
        actorId: actor.id,
        workspaceId: query.workspaceId,
        storyId: validatedStoryId,
      },
      graphDependencies,
    );
    return NextResponse.json(
      listScopesResponseSchema.parse({ scopes: scopes.map(toScopeResponse) }),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ storyId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { storyId } = await context.params;
    const validatedStoryId = graphIdSchema.parse(storyId);
    const body = createScopeRequestSchema.parse(await request.json());
    const created = await createScope(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        storyId: validatedStoryId,
        name: body.name,
        description: body.description,
      },
      graphDependencies,
    );
    return NextResponse.json(toScopeResponse(created), { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
