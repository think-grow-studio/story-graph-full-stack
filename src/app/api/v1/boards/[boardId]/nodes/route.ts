import { NextResponse } from "next/server";

import { createNode } from "@/backend/modules/graph/application/create-node/create-node";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  createNodeRequestSchema,
  graphIdSchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../_shared/graph-dependencies";
import { toGraphNodeResponse } from "../../../_shared/graph-http";
import { identityDependencies } from "../../../_shared/identity-dependencies";
import { routeErrorResponse } from "../../../_shared/route-error";

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string }> },
) {
  try {
    const actor = await requireCurrentActor(request.headers, identityDependencies);
    const { boardId } = await context.params;
    const validatedBoardId = graphIdSchema.parse(boardId);
    const body = createNodeRequestSchema.parse(await request.json());
    const created = await createNode(
      {
        actorId: actor.id,
        workspaceId: body.workspaceId,
        boardId: validatedBoardId,
        id: body.id,
        name: body.name,
        description: body.description,
        iconKey: body.iconKey,
        properties: body.properties,
        x: body.x,
        y: body.y,
        width: body.width,
        height: body.height,
        zIndex: body.zIndex,
        style: body.style,
      },
      graphDependencies,
    );
    return NextResponse.json(toGraphNodeResponse(created), { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
