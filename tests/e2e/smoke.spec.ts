import { expect, test } from "@playwright/test";

test("renders the public product entry", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "이야기는 연결될 때 선명해집니다." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인" })).toHaveAttribute(
    "href",
    "/login",
  );
  await expect(page.getByRole("link", { name: "시작하기" })).toHaveAttribute(
    "href",
    "/signup",
  );
});

test("serves the versioned health API", async ({ request }) => {
  const response = await request.get("/api/v1/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
