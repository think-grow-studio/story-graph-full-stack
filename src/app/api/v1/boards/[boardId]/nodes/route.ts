import { NextResponse } from "next/server";

import { createNodeOnBoard } from "@/backend/modules/graph/application/create-node-on-board/create-node-on-board";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  createNodeRequestSchema,
  createNodeResponseSchema,
  graphIdSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../_shared/graph-dependencies";
import { toBoardNodeResponse, toGraphNodeResponse } from "../../_shared/graph-http";
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
    const body = createNodeRequestSchema.parse(await request.json());
    const result = await createNodeOnBoard(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        id: body.id,
        name: body.name,
        description: body.description,
        iconKey: body.iconKey,
        properties: body.properties,
        x: body.position.x,
        y: body.position.y,
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
      { status: 201 },
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
