import { NextResponse } from "next/server";

import { placeNodeOnBoard } from "@/backend/modules/graph/application/place-node-on-board/place-node-on-board";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  createNodeResponseSchema,
  graphIdSchema,
  placeBoardNodeRequestSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../../../_shared/graph-dependencies";
import {
  toBoardNodeResponse,
  toGraphNodeResponse,
} from "../../../../../_shared/graph-http";
import { identityDependencies } from "../../../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../../../_shared/route-error";

type Context = {
  params: Promise<{ boardId: string; nodeId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId, nodeId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const validatedNodeId = graphIdSchema.parse(nodeId);
    const body = placeBoardNodeRequestSchema.parse(await request.json());
    const result = await placeNodeOnBoard(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        nodeId: validatedNodeId,
        x: body.x,
        y: body.y,
        width: body.width,
        height: body.height,
        zIndex: body.zIndex,
        style: body.style,
      },
      graphDependencies,
    );
    return NextResponse.json(
      createNodeResponseSchema.parse({
        node: toGraphNodeResponse(result.node),
        boardNode: toBoardNodeResponse(result.boardNode),
      }),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
