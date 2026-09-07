import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi-document";

describe("buildOpenApiDocument", () => {
  it("documents the public V1 API from shared contracts", async () => {
    const document = await buildOpenApiDocument();

    expect(document.openapi).toBe("3.0.0");
    expect(document.info.title).toBe("Story Graph API");
    expect(document.components?.securitySchemes).toMatchObject({
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
      },
    });

    expect(document.paths).toBeDefined();
    const paths = document.paths ?? {};

    expect(paths).toHaveProperty("/api/v1/health");
    expect(paths).toHaveProperty("/api/v1/bootstrap");
    expect(paths).toHaveProperty("/api/v1/stories");
    expect(paths).toHaveProperty("/api/v1/stories/{storyId}");

    expect(paths["/api/v1/stories"]?.post).toBeDefined();
    expect(paths["/api/v1/stories"]?.get).toBeDefined();
    expect(paths["/api/v1/stories/{storyId}"]?.get).toBeDefined();
    expect(paths["/api/v1/stories/{storyId}"]?.patch).toBeDefined();
    expect(paths["/api/v1/stories/{storyId}"]?.delete).toBeDefined();
  });

  it("documents only the Board-owned Graph V1 surface", async () => {
    const document = await buildOpenApiDocument();
    const paths = document.paths ?? {};

    expect(paths["/api/v1/stories/{storyId}/boards"]?.get).toBeDefined();
    expect(paths["/api/v1/stories/{storyId}/boards"]?.post).toBeDefined();

    expect(paths["/api/v1/boards/{boardId}"]?.patch).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/snapshot"]?.get).toBeDefined();

    expect(paths["/api/v1/boards/{boardId}/nodes"]?.post).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/nodes/{nodeId}"]?.patch).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/nodes/{nodeId}"]?.delete).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/nodes/{nodeId}/restore"]?.post).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/nodes/{nodeId}"]?.put).toBeUndefined();

    expect(paths["/api/v1/boards/{boardId}/edges"]?.post).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/edges/{edgeId}"]?.patch).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/edges/{edgeId}"]?.delete).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/edges/{edgeId}/restore"]?.post).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/edges/{edgeId}"]?.put).toBeUndefined();

    expect(paths["/api/v1/boards/{boardId}/nodes/{nodeId}"]?.patch?.responses?.["409"]).toBeDefined();
    expect(paths["/api/v1/boards/{boardId}/edges/{edgeId}"]?.patch?.responses?.["409"]).toBeDefined();

    expect(paths).not.toHaveProperty("/api/v1/stories/{storyId}/nodes");
    expect(paths).not.toHaveProperty("/api/v1/stories/{storyId}/scopes");
    expect(paths).not.toHaveProperty("/api/v1/scopes/{scopeId}/nodes/{nodeId}/state");
    expect(paths).not.toHaveProperty("/api/v1/scopes/{scopeId}/edges/{edgeId}/state");
    expect(paths).not.toHaveProperty("/api/v1/nodes/{nodeId}");
    expect(paths).not.toHaveProperty("/api/v1/edges/{edgeId}");
    expect(paths).not.toHaveProperty(
      "/api/v1/boards/{boardId}/nodes/{nodeId}/presentation",
    );
  });

  it("documents Graph Editor V2 semantic, presentation, routing, and property fields", async () => {
    const document = await buildOpenApiDocument();
    const schemas = document.components?.schemas ?? {};

    expect(schemas.BoardResponse).toMatchObject({
      type: "object",
      properties: {
        graphSettings: {
          type: "object",
          properties: {
            defaultEdgeRouting: { enum: ["orthogonal", "straight", "curved"] },
            snapToGrid: { type: "boolean" },
            layoutMode: { enum: ["free"] },
          },
        },
      },
    });

    expect(schemas.GraphNodeResponse).toMatchObject({
      type: "object",
      properties: {
        kind: { type: "string" },
        properties: {
          type: "object",
          description: expect.stringContaining("scalar leaves are strings"),
        },
        presentation: {
          type: "object",
          properties: {
            shape: { enum: ["rounded-rect", "rect", "ellipse", "diamond"] },
          },
        },
      },
    });

    expect(schemas.GraphEdgeResponse).toMatchObject({
      type: "object",
      properties: {
        direction: { enum: ["DIRECTED", "UNDIRECTED"] },
        kind: { type: "string" },
        properties: {
          type: "object",
          description: expect.stringContaining("scalar leaves are strings"),
        },
        presentation: {
          type: "object",
          properties: {
            strokeStyle: { enum: ["solid", "dashed", "dotted"] },
          },
        },
        routing: {
          type: "object",
          properties: {
            type: { enum: ["orthogonal", "straight", "curved"] },
            sourcePort: { enum: ["auto", "top", "right", "bottom", "left"] },
            targetPort: { enum: ["auto", "top", "right", "bottom", "left"] },
          },
        },
      },
    });

    expect(JSON.stringify(schemas.GraphNodeResponse)).not.toContain('"style"');
    expect(JSON.stringify(schemas.GraphEdgeResponse)).not.toContain('"labelPresentation"');
  });
});
