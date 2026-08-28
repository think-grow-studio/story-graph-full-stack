import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
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
    { healthResponseSchema },
  ] = await Promise.all([
    import("@/contracts/auth/bootstrap.contract"),
    import("@/contracts/common/error.contract"),
    import("@/contracts/story/story.contract"),
    import("@/contracts/system/health.contract"),
  ]);

  const registry = new OpenAPIRegistry();
  const healthResponse = registry.register("HealthResponse", healthResponseSchema);
  const bootstrapResponse = registry.register("BootstrapResponse", bootstrapResponseSchema);
  const storyResponse = registry.register("StoryResponse", storyResponseSchema);
  const listStoriesResponse = registry.register("ListStoriesResponse", listStoriesResponseSchema);
  const apiErrorResponse = registry.register("ApiErrorResponse", apiErrorResponseSchema);

  registry.registerComponent("securitySchemes", "sessionCookie", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description: "Better Auth database session cookie. Secure deployments may add a __Secure- prefix.",
  });

  const secured = [{ sessionCookie: [] }];
  const errorResponse = { description: "API error", content: json(apiErrorResponse) };
  const storyIdParams = z.object({ storyId: z.string().min(1) });

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

  registry.registerPath({
    method: "get",
    path: "/api/v1/stories/{storyId}",
    tags: ["Stories"],
    summary: "Get a Story",
    security: secured,
    request: { params: storyIdParams, query: storyWorkspaceQuerySchema },
    responses: {
      200: { description: "Story", content: json(storyResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/v1/stories/{storyId}",
    tags: ["Stories"],
    summary: "Update a Story",
    security: secured,
    request: {
      params: storyIdParams,
      body: { content: json(updateStoryRequestSchema) },
    },
    responses: {
      200: { description: "Updated Story", content: json(storyResponse) },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/v1/stories/{storyId}",
    tags: ["Stories"],
    summary: "Delete a Story",
    security: secured,
    request: { params: storyIdParams, query: storyWorkspaceQuerySchema },
    responses: {
      204: { description: "Story deleted" },
      400: errorResponse,
      401: errorResponse,
      403: errorResponse,
      404: errorResponse,
    },
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Story Graph API",
      version: "1.0.0",
      description: "HTTP API for Story Graph. Product endpoints use Better Auth session cookies.",
    },
  });
}
