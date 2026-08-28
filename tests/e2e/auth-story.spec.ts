import { expect, test } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

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

test("authenticated users cannot manage the hidden Workspace through Better Auth", async ({
  context,
}) => {
  const identity = await createE2EIdentity("Workspace Boundary User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const sameOriginHeaders = { origin: "http://localhost:3000" };

    const createResponse = await context.request.post(
      "/api/auth/organization/create",
      {
        headers: sameOriginHeaders,
        data: {
          name: "Rogue Workspace",
          slug: `rogue-${crypto.randomUUID()}`,
        },
      },
    );

    const updateResponse = await context.request.post(
      "/api/auth/organization/update",
      {
        headers: sameOriginHeaders,
        data: {
          organizationId: bootstrap.workspace.id,
          data: {
            slug: `tampered-${crypto.randomUUID()}`,
          },
        },
      },
    );

    const deleteResponse = await context.request.post(
      "/api/auth/organization/delete",
      {
        headers: sameOriginHeaders,
        data: {
          organizationId: bootstrap.workspace.id,
        },
      },
    );

    expect([
      createResponse.status(),
      updateResponse.status(),
      deleteResponse.status(),
    ]).toEqual([403, 403, 403]);
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("authenticated user creates a Story that survives reload", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("E2E Google User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    const bootstrapBody = await bootstrapResponse.text();
    expect(bootstrapResponse.status(), bootstrapBody).toBe(200);
    expect(JSON.parse(bootstrapBody).workspace.name).toBe(
      "E2E Google User's Workspace",
    );

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

test("Graph Core snapshot survives a page reload", async ({ context, page }) => {
  const identity = await createE2EIdentity("Graph Persistence User");

  try {
    await context.addCookies(identity.cookies);

    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const bootstrap = await bootstrapResponse.json();
    const workspaceId = bootstrap.workspace.id as string;

    const storyResponse = await context.request.post("/api/v1/stories", {
      data: { workspaceId, name: "Persistent Graph Story" },
    });
    expect(storyResponse.status()).toBe(201);
    const story = await storyResponse.json();

    const boardResponse = await context.request.post(
      `/api/v1/stories/${story.id}/boards`,
      { data: { workspaceId, name: "Main Board" } },
    );
    expect(boardResponse.status()).toBe(201);
    const board = await boardResponse.json();

    const nodeId = crypto.randomUUID();
    const nodeResponse = await context.request.post(
      `/api/v1/boards/${board.id}/nodes`,
      {
        data: {
          workspaceId,
          id: nodeId,
          name: "Persistent Node",
          position: { x: 120, y: 80 },
        },
      },
    );
    expect(nodeResponse.status()).toBe(201);

    const firstSnapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(firstSnapshotResponse.status()).toBe(200);
    const firstSnapshot = await firstSnapshotResponse.json();
    expect(firstSnapshot.nodes).toEqual([
      expect.objectContaining({ id: nodeId, version: 1, name: "Persistent Node" }),
    ]);
    expect(firstSnapshot.boardNodes).toEqual([
      expect.objectContaining({ nodeId, x: 120, y: 80 }),
    ]);

    await page.goto("/dashboard");
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);

    const secondSnapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(secondSnapshotResponse.status()).toBe(200);
    const secondSnapshot = await secondSnapshotResponse.json();
    expect(secondSnapshot.nodes).toEqual([
      expect.objectContaining({ id: nodeId, version: 1, name: "Persistent Node" }),
    ]);
    expect(secondSnapshot.boardNodes).toEqual([
      expect.objectContaining({ nodeId, x: 120, y: 80 }),
    ]);
  } finally {
    await cleanupE2EIdentity(identity);
  }
});
