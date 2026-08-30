import { NextResponse } from "next/server";

import { listStoryNodes } from "@/backend/modules/graph/application/list-story-nodes/list-story-nodes";
import { requireCurrentActor } from "@/backend/modules/identity/application/get-current-actor/get-current-actor";
import {
  graphIdSchema,
  listStoryNodesResponseSchema,
  workspaceQuerySchema,
} from "@/contracts/graph/graph.contract";
import { graphDependencies } from "../../../_shared/graph-dependencies";
import { toGraphNodeResponse } from "../../../_shared/graph-http";
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
    const nodes = await listStoryNodes(
      {
        actorId: actor.id,
        workspaceId: query.workspaceId,
        storyId: validatedStoryId,
      },
      graphDependencies,
    );
    return NextResponse.json(
      listStoryNodesResponseSchema.parse({ nodes: nodes.map(toGraphNodeResponse) }),
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
