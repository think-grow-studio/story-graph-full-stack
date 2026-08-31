import { NextResponse } from "next/server";

import { putEdgeState } from "@/backend/modules/graph/application/put-edge-state/put-edge-state";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  edgeStateResponseSchema,
  graphIdSchema,
  putEdgeStateRequestSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../../_shared/graph-dependencies";
import { toEdgeStateResponse } from "../../../../../_shared/graph-http";
import { identityDependencies } from "../../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../../_shared/route-error";

type Context = {
  params: Promise<{ scopeId: string; edgeId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { scopeId, edgeId } = await context.params;
    const validatedScopeId = graphIdSchema.parse(scopeId);
    const validatedEdgeId = graphIdSchema.parse(edgeId);
    const body = putEdgeStateRequestSchema.parse(await request.json());
    const result = await putEdgeState(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        scopeId: validatedScopeId,
        edgeId: validatedEdgeId,
        version: body.version,
        name: body.name,
        description: body.description,
        properties: body.properties,
      },
      graphDependencies,
    );
    return NextResponse.json(
      edgeStateResponseSchema.parse(toEdgeStateResponse(result)),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
