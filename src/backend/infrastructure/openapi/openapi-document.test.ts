import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi-document";

describe("buildOpenApiDocument", () => {
  it("documents the public V1 API from shared contracts", async () => {
    const document = await buildOpenApiDocument();

    expect(document.openapi).toBe("3.1.0");
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
});
