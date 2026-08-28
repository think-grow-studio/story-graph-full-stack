import { expect, test } from "@playwright/test";

import {
  cleanupE2EIdentity,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test("Google is the only authentication entry", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
});

test("authenticated user creates a Story that survives reload", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("E2E Google User");

  try {
    await context.addCookies(identity.cookies);
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "E2E Google User's Workspace" }),
    ).toBeVisible();

    await page.getByLabel("Story name").fill("My First Story");
    await page.getByRole("button", { name: "Create Story" }).click();
    await expect(page.getByText("My First Story")).toBeVisible();

    await page.reload();
    await expect(page.getByText("My First Story")).toBeVisible();
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
