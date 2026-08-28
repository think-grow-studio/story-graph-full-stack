import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi-document";

describe("buildOpenApiDocument", () => {
  it("documents the public V1 API from shared contracts", () => {
    const document = buildOpenApiDocument();

    expect(document.openapi).toBe("3.1.0");
    expect(document.info.title).toBe("Story Graph API");
    expect(document.components?.securitySchemes).toMatchObject({
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
      },
    });

    expect(document.paths).toHaveProperty("/api/v1/health");
    expect(document.paths).toHaveProperty("/api/v1/bootstrap");
    expect(document.paths).toHaveProperty("/api/v1/stories");
    expect(document.paths).toHaveProperty("/api/v1/stories/{storyId}");

    expect(document.paths["/api/v1/stories"]?.post).toBeDefined();
    expect(document.paths["/api/v1/stories"]?.get).toBeDefined();
    expect(document.paths["/api/v1/stories/{storyId}"]?.get).toBeDefined();
    expect(document.paths["/api/v1/stories/{storyId}"]?.patch).toBeDefined();
    expect(document.paths["/api/v1/stories/{storyId}"]?.delete).toBeDefined();
  });
});
