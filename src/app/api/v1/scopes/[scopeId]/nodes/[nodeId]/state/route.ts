import { NextResponse } from "next/server";

import { putNodeState } from "@/backend/modules/graph/application/put-node-state/put-node-state";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphIdSchema,
  nodeStateResponseSchema,
  putNodeStateRequestSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../../_shared/graph-dependencies";
import { toNodeStateResponse } from "../../../../../_shared/graph-http";
import { identityDependencies } from "../../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../../_shared/route-error";

type Context = {
  params: Promise<{ scopeId: string; nodeId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { scopeId, nodeId } = await context.params;
    const validatedScopeId = graphIdSchema.parse(scopeId);
    const validatedNodeId = graphIdSchema.parse(nodeId);
    const body = putNodeStateRequestSchema.parse(await request.json());
    const result = await putNodeState(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        scopeId: validatedScopeId,
        nodeId: validatedNodeId,
        version: body.version,
        name: body.name,
        description: body.description,
        properties: body.properties,
      },
      graphDependencies,
    );
    return NextResponse.json(
      nodeStateResponseSchema.parse(toNodeStateResponse(result)),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
