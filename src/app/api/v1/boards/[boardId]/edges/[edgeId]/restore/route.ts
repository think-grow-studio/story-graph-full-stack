import { NextResponse } from "next/server";

import { restoreEdge } from "@/backend/modules/graph/application/restore-edge/restore-edge";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphEdgeResponseSchema,
  graphIdSchema,
  restoreEdgeRequestSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../../_shared/graph-dependencies";
import { toGraphEdgeResponse } from "../../../../../_shared/graph-http";
import { identityDependencies } from "../../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../../_shared/route-error";

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string; edgeId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, edgeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedEdgeId = graphIdSchema.parse(edgeId);
    const body = restoreEdgeRequestSchema.parse(await request.json());
    const restored = await restoreEdge(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        edgeId: validatedEdgeId,
        edge: body.edge,
      },
      graphDependencies,
    );
    return NextResponse.json(graphEdgeResponseSchema.parse(toGraphEdgeResponse(restored)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
