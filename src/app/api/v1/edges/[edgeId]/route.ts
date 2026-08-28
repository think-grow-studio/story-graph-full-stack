import { NextResponse } from "next/server";

import { updateEdge } from "@/backend/modules/graph/application/update-edge/update-edge";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphEdgeResponseSchema,
  graphIdSchema,
  updateEdgeRequestSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../_shared/graph-dependencies";
import { toGraphEdgeResponse } from "../../_shared/graph-http";
import { identityDependencies } from "../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../_shared/route-error";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ edgeId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { edgeId } = await context.params;
    const validatedEdgeId = graphIdSchema.parse(edgeId);
    const body = updateEdgeRequestSchema.parse(await request.json());
    const updated = await updateEdge(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        edgeId: validatedEdgeId,
        version: body.version,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.iconKey !== undefined ? { iconKey: body.iconKey } : {}),
        ...(body.properties !== undefined ? { properties: body.properties } : {}),
      },
      graphDependencies,
    );
    return NextResponse.json(graphEdgeResponseSchema.parse(toGraphEdgeResponse(updated)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
