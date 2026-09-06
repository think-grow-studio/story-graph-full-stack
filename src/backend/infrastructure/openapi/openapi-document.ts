import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

const json = (schema: z.ZodType) => ({
  "application/json": { schema },
});

export async function buildOpenApiDocument() {
  const [
    { bootstrapResponseSchema },
    { apiErrorResponseSchema },
    {
      createStoryRequestSchema,
      listStoriesQuerySchema,
      listStoriesResponseSchema,
      storyResponseSchema,
      storyWorkspaceQuerySchema,
      updateStoryRequestSchema,
    },
    {
      boardResponseSchema,
      boardSnapshotResponseSchema,
      createBoardRequestSchema,
      createEdgeRequestSchema,
      createNodeRequestSchema,
      graphEdgeResponseSchema,
      graphIdSchema,
      graphNodeResponseSchema,
      listBoardsResponseSchema,
      updateEdgeRequestSchema,
      updateNodeRequestSchema,
      workspaceQuerySchema,
    },
    { healthResponseSchema },
  ] = await Promise.all([
    import("@/contracts/auth/bootstrap.contract"),
    import("@/contracts/common/error.contract"),
    import("@/contracts/story/story.contract"),
    import("@/contracts/graph/graph.contract"),
    import("@/contracts/system/health.contract"),
  ]);

  const registry = new OpenAPIRegistry();
  const healthResponse = registry.register("HealthResponse", healthResponseSchema);
  const bootstrapResponse = registry.register("BootstrapResponse", bootstrapResponseSchema);
  const storyResponse = registry.register("StoryResponse", storyResponseSchema);
  const listStoriesResponse = registry.register("ListStoriesResponse", listStoriesResponseSchema);
  const apiErrorResponse = registry.register("ApiErrorResponse", apiErrorResponseSchema);
  const createBoardRequest = registry.register("CreateBoardRequest", createBoardRequestSchema);
  const boardResponse = registry.register("BoardResponse", boardResponseSchema);
  const listBoardsResponse = registry.register("ListBoardsResponse", listBoardsResponseSchema);
  const createNodeRequest = registry.register("CreateNodeRequest", createNodeRequestSchema);
  const updateNodeRequest = registry.register("UpdateNodeRequest", updateNodeRequestSchema);
  const graphNodeResponse = registry.register("GraphNodeResponse", graphNodeResponseSchema);
  const createEdgeRequest = registry.register("CreateEdgeRequest", createEdgeRequestSchema);
  const updateEdgeRequest = registry.register("UpdateEdgeRequest", updateEdgeRequestSchema);
  const graphEdgeResponse = registry.register("GraphEdgeResponse", graphEdgeResponseSchema);
  const boardSnapshotResponse = registry.register(
    "BoardSnapshotResponse",
    boardSnapshotResponseSchema,
  );

  registry.registerComponent("securitySchemes", "sessionCookie", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description: "Better Auth database session cookie. Secure deployments may add a __Secure- prefix.",
  });

  const secured = [{ sessionCookie: [] }];
  const errorResponse = { description: "API error", content: json(apiErrorResponse) };
  const storyIdParams = z.object({ storyId: z.string().min(1) });
  const graphStoryIdParams = z.object({ storyId: graphIdSchema });
  const boardIdParams = z.object({ boardId: graphIdSchema });
  const boardNodeParams = z.object({ boardId: graphIdSchema, nodeId: graphIdSchema });
  const boardEdgeParams = z.object({ boardId: graphIdSchema, edgeId: graphIdSchema });

  registry.registerPath({
    method: "get",
    path: "/api/v1/health",
    tags: ["System"],
    summary: "Health check",
    responses: { 200: { description: "Service is healthy", content: json(healthResponse) } },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/bootstrap",
    tags: ["Auth"],
    summary: "Resolve the current actor and personal workspace",
    security: secured,
    responses: {
      200: { description: "Bootstrap context", content: json(bootstrapResponse) },
      401: errorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/stories",
    tags: ["Stories"],
    summary: "List Stories in a workspace",
    security: secured,
    request: { query: listStoriesQuerySchema },
    responses: {
      200: { description: "Story list", content: json(listStoriesResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/stories",
    tags: ["Stories"],
    summary: "Create a Story",
    security: secured,
    request: { body: { content: json(createStoryRequestSchema) } },
    responses: {
      201: { description: "Created Story", content: json(storyResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
    },
  });

  for (const method of ["get", "patch", "delete"] as const) {
    registry.registerPath({
      method,
      path: "/api/v1/stories/{storyId}",
      tags: ["Stories"],
      summary: `${method} Story`,
      security: secured,
      request:
        method === "get" || method === "delete"
          ? { params: storyIdParams, query: storyWorkspaceQuerySchema }
          : {
              params: storyIdParams,
              body: { content: json(updateStoryRequestSchema) },
            },
      responses:
        method === "delete"
          ? { 204: { description: "Story deleted" }, 400: errorResponse, 401: errorResponse, 403: errorResponse, 404: errorResponse }
          : { 200: { description: "Story", content: json(storyResponse) }, 400: errorResponse, 401: errorResponse, 403: errorResponse, 404: errorResponse },
    });
  }

  registry.registerPath({
    method: "get",
    path: "/api/v1/stories/{storyId}/boards",
    tags: ["Graph"],
    summary: "List Boards for a Story",
    security: secured,
    request: { params: graphStoryIdParams, query: workspaceQuerySchema },
    responses: {
      200: { description: "Board list", content: json(listBoardsResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/stories/{storyId}/boards",
    tags: ["Graph"],
    summary: "Create a Board for a Story",
    security: secured,
    request: { params: graphStoryIdParams, body: { content: json(createBoardRequest) } },
    responses: {
      201: { description: "Created Board", content: json(boardResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/boards/{boardId}/snapshot",
    tags: ["Graph"],
    summary: "Load a Board snapshot",
    security: secured,
    request: { params: boardIdParams, query: workspaceQuerySchema },
    responses: {
      200: { description: "Board snapshot", content: json(boardSnapshotResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/boards/{boardId}/nodes",
    tags: ["Graph"],
    summary: "Create a Board Node",
    security: secured,
    request: { params: boardIdParams, body: { content: json(createNodeRequest) } },
    responses: {
      201: { description: "Created Node", content: json(graphNodeResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/v1/boards/{boardId}/nodes/{nodeId}",
    tags: ["Graph"],
    summary: "Update a Board Node",
    security: secured,
    request: { params: boardNodeParams, body: { content: json(updateNodeRequest) } },
    responses: {
      200: { description: "Updated Node", content: json(graphNodeResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/v1/boards/{boardId}/nodes/{nodeId}",
    tags: ["Graph"],
    summary: "Delete a Board Node",
    security: secured,
    request: { params: boardNodeParams, query: workspaceQuerySchema },
    responses: {
      204: { description: "Node deleted" },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/v1/boards/{boardId}/edges",
    tags: ["Graph"],
    summary: "Create a Board Edge",
    security: secured,
    request: { params: boardIdParams, body: { content: json(createEdgeRequest) } },
    responses: {
      201: { description: "Created Edge", content: json(graphEdgeResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/v1/boards/{boardId}/edges/{edgeId}",
    tags: ["Graph"],
    summary: "Update a Board Edge",
    security: secured,
    request: { params: boardEdgeParams, body: { content: json(updateEdgeRequest) } },
    responses: {
      200: { description: "Updated Edge", content: json(graphEdgeResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
      409: errorResponse,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/v1/boards/{boardId}/edges/{edgeId}",
    tags: ["Graph"],
    summary: "Delete a Board Edge",
    security: secured,
    request: { params: boardEdgeParams, query: workspaceQuerySchema },
    responses: {
      204: { description: "Edge deleted" },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Story Graph API",
      version: "1.0.0",
      description: "HTTP API for Story Graph. Product endpoints use Better Auth session cookies.",
    },
  });
}
