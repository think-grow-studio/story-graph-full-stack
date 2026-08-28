import { NextResponse } from "next/server";

import { updateNode } from "@/backend/modules/graph/application/update-node/update-node";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphIdSchema,
  graphNodeResponseSchema,
  updateNodeRequestSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../_shared/graph-dependencies";
import { toGraphNodeResponse } from "../../_shared/graph-http";
import { identityDependencies } from "../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../_shared/route-error";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ nodeId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { nodeId } = await context.params;
    const validatedNodeId = graphIdSchema.parse(nodeId);
    const body = updateNodeRequestSchema.parse(await request.json());
    const updated = await updateNode(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        nodeId: validatedNodeId,
        version: body.version,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.iconKey !== undefined ? { iconKey: body.iconKey } : {}),
        ...(body.properties !== undefined ? { properties: body.properties } : {}),
      },
      graphDependencies,
    );
    return NextResponse.json(graphNodeResponseSchema.parse(toGraphNodeResponse(updated)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
