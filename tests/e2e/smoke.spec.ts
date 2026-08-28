import { expect, test } from "@playwright/test";

test("renders the Story Graph shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Story Graph" })).toBeVisible();
});

test("serves the versioned health API", async ({ request }) => {
  const response = await request.get("/api/v1/health");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
