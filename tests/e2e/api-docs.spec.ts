import { expect, test } from "@playwright/test";

test("OpenAPI JSON exposes the Story Graph V1 contract", async ({ request }) => {
  const response = await request.get("/api/openapi.json");
  expect(response.status()).toBe(200);

  const document = await response.json();
  expect(document.openapi).toBe("3.1.0");
  expect(document.info.title).toBe("Story Graph API");
  expect(document.paths).toHaveProperty("/api/v1/health");
  expect(document.paths).toHaveProperty("/api/v1/bootstrap");
  expect(document.paths).toHaveProperty("/api/v1/stories");
  expect(document.paths).toHaveProperty("/api/v1/stories/{storyId}");
});

test("Swagger UI renders the generated OpenAPI document without runtime errors", async ({ page }) => {
  const swaggerRuntimeErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("OpenApi3_1Element.refract is not a function")
    ) {
      swaggerRuntimeErrors.push(message.text());
    }
  });

  await page.goto("/docs");

  await expect(page.locator(".info .title")).toContainText("Story Graph API");
  await expect(
    page.locator(".opblock-summary-path").filter({ hasText: "/api/v1/stories" }).first(),
  ).toBeVisible();
  expect(swaggerRuntimeErrors).toEqual([]);
});
