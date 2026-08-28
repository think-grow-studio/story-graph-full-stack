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
  await page.addInitScript(() => {
    const runtimeWindow = window as typeof window & { __swaggerConsoleErrors?: string[] };
    runtimeWindow.__swaggerConsoleErrors = [];
    const originalConsoleError = console.error.bind(console);

    console.error = (...args: unknown[]) => {
      runtimeWindow.__swaggerConsoleErrors?.push(args.map(String).join(" "));
      originalConsoleError(...args);
    };
  });

  await page.goto("/docs");

  await expect(page.locator(".info .title")).toContainText("Story Graph API");
  await expect(
    page.locator(".opblock-summary-path").filter({ hasText: "/api/v1/stories" }).first(),
  ).toBeVisible();

  const swaggerRuntimeErrors = await page.evaluate(() => {
    const runtimeWindow = window as typeof window & { __swaggerConsoleErrors?: string[] };
    return (runtimeWindow.__swaggerConsoleErrors ?? []).filter((message) =>
      message.includes("OpenApi3_1Element.refract is not a function"),
    );
  });
  expect(swaggerRuntimeErrors).toEqual([]);
});
