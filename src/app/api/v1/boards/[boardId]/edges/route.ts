import { NextResponse } from "next/server";

import { createEdgeOnBoard } from "@/backend/modules/graph/application/create-edge-on-board/create-edge-on-board";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  createEdgeRequestSchema,
  createEdgeResponseSchema,
  graphIdSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../_shared/graph-dependencies";
import { toBoardEdgeResponse, toGraphEdgeResponse } from "../../_shared/graph-http";
import { identityDependencies } from "../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../_shared/route-error";

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const body = createEdgeRequestSchema.parse(await request.json());
    const result = await createEdgeOnBoard(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        id: body.id,
        sourceNodeId: body.sourceNodeId,
        targetNodeId: body.targetNodeId,
        name: body.name,
        description: body.description,
        iconKey: body.iconKey,
        properties: body.properties,
      },
      graphDependencies,
    );
    return NextResponse.json(
      createEdgeResponseSchema.parse({
        edge: toGraphEdgeResponse(result.edge),
        boardEdge: toBoardEdgeResponse(result.boardEdge),
      }),
      { status: 201 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
