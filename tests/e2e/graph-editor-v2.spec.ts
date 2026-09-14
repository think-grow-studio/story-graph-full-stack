import { expect, test, type Page } from "@playwright/test";

import {
  cleanupE2EIdentity,
  closeE2EAuthDatabase,
  createE2EIdentity,
} from "./helpers/e2e-auth";
import {
  createE2EBoard,
  createE2EEdge,
  createE2ENode,
  createE2EStory,
} from "./helpers/graph-fixtures";

type GraphPatchPayload = {
  routing?: { type?: string };
  properties?: {
    profile?: string | { role?: string };
  };
};

test.afterAll(async () => {
  await closeE2EAuthDatabase();
});

function getProfileObject(payload: GraphPatchPayload) {
  const profile = payload.properties?.profile;
  return typeof profile === "object" && profile !== null ? profile : null;
}

function waitForPatch(
  page: Page,
  pathname: string,
  predicate: (payload: GraphPatchPayload) => boolean,
) {
  return page.waitForResponse((response) => {
    if (
      response.request().method() !== "PATCH" ||
      new URL(response.url()).pathname !== pathname
    ) {
      return false;
    }

    return predicate(response.request().postDataJSON() as GraphPatchPayload);
  });
}

function relationshipRailTrigger(page: Page, left: string, right: string) {
  return page.getByRole("button", {
    name: new RegExp(`^(${left}와 ${right}|${right}와 ${left}) 관계 보기$`),
  });
}

async function selectRelationshipPair(
  page: Page,
  source: string,
  target: string,
  name: string,
) {
  const trigger = relationshipRailTrigger(page, source, target);
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();
  await expect(page.getByText(`${source} ↔ ${target}`)).toBeVisible();
  await expect(page.getByLabel(`${source} → ${target} 관계`)).toHaveValue(name);
}

async function connectByDrag(
  page: Page,
  sourceNodeId: string,
  targetNodeId: string,
) {
  const sourceHandle = page
    .locator(`.react-flow__node[data-id="${sourceNodeId}"]`)
    .locator('.react-flow__handle[data-handleid="right"]');
  const targetHandle = page
    .locator(`.react-flow__node[data-id="${targetNodeId}"]`)
    .locator('.react-flow__handle[data-handleid="left"]');
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
}

test("Graph V2 keeps semantic Relationships distinct behind one shared rail", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph V2 Bundle User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(
      context.request,
      workspaceId,
      "Graph V2 Bundle Story",
    );
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Bundle Board",
    );
    const alice = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Alice",
      x: 80,
      y: 160,
    });
    const bob = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Bob",
      x: 460,
      y: 160,
    });

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    await connectByDrag(page, alice.id, bob.id);
    await expect(page.getByRole("dialog", { name: "관계 만들기" })).toBeVisible();
    await expect(page.getByText("Alice → Bob")).toBeVisible();
    await page.getByLabel("관계 이름").fill("친구라고 생각함");
    const firstCreatePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/v1/boards/${board.id}/edges`,
    );
    await page.getByRole("button", { name: "관계 만들기" }).click();
    const firstCreate = await firstCreatePromise;
    expect(firstCreate.status()).toBe(201);
    const firstEdge = await firstCreate.json();

    const aliceNode = page.locator(`.react-flow__node[data-id="${alice.id}"]`);
    const bobNode = page.locator(`.react-flow__node[data-id="${bob.id}"]`);

    await bobNode.click();
    await page.getByRole("button", { name: "관계 만들기" }).click();
    await aliceNode.click();
    await expect(page.getByText("Bob → Alice")).toBeVisible();
    await page.getByLabel("관계 이름").fill("친구라고 속임");
    const oppositeCreatePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/v1/boards/${board.id}/edges`,
    );
    await page.getByRole("button", { name: "관계 만들기" }).click();
    const oppositeCreate = await oppositeCreatePromise;
    expect(oppositeCreate.status()).toBe(201);
    const oppositeEdge = await oppositeCreate.json();

    await aliceNode.click();
    await page.getByRole("button", { name: "관계 만들기" }).click();
    await bobNode.click();
    await expect(page.getByText("Alice → Bob")).toBeVisible();
    await page.getByLabel("관계 이름").fill("함께 여행함");
    const parallelCreatePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/api/v1/boards/${board.id}/edges`,
    );
    await page.getByRole("button", { name: "관계 만들기" }).click();
    const parallelCreate = await parallelCreatePromise;
    expect(parallelCreate.status()).toBe(201);
    const parallelEdge = await parallelCreate.json();

    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    const railTrigger = relationshipRailTrigger(page, "Alice", "Bob");
    await expect(railTrigger).toBeVisible();
    await expect(railTrigger).toContainText("친구라고 생각함");
    await expect(railTrigger).toContainText("친구라고 속임");
    await railTrigger.hover();
    await expect(page.getByText("관계 3개")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Alice → Bob: 친구라고 생각함" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Bob → Alice: 친구라고 속임" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Alice → Bob: 함께 여행함" }),
    ).toBeVisible();

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        id: firstEdge.id,
        sourceNodeId: alice.id,
        targetNodeId: bob.id,
        name: "친구라고 생각함",
      }),
    );
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        id: oppositeEdge.id,
        sourceNodeId: bob.id,
        targetNodeId: alice.id,
        name: "친구라고 속임",
      }),
    );
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        id: parallelEdge.id,
        sourceNodeId: alice.id,
        targetNodeId: bob.id,
        name: "함께 여행함",
      }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph V2 projects Node and Relationship focus onto shared rails", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph V2 Focus User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(
      context.request,
      workspaceId,
      "Graph V2 Focus Story",
    );
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Focus Board",
    );
    const alice = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Alice",
      x: 80,
      y: 120,
    });
    const bob = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Bob",
      x: 460,
      y: 120,
    });
    const charlie = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Charlie",
      x: 80,
      y: 420,
    });
    const dana = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Dana",
      x: 460,
      y: 420,
    });

    await createE2EEdge(context.request, board.id, workspaceId, {
      sourceNodeId: alice.id,
      targetNodeId: bob.id,
      name: "친구라고 생각함",
    });
    await createE2EEdge(context.request, board.id, workspaceId, {
      sourceNodeId: bob.id,
      targetNodeId: alice.id,
      name: "친구라고 속임",
    });
    await createE2EEdge(context.request, board.id, workspaceId, {
      sourceNodeId: alice.id,
      targetNodeId: bob.id,
      name: "함께 여행함",
    });
    await createE2EEdge(context.request, board.id, workspaceId, {
      sourceNodeId: charlie.id,
      targetNodeId: dana.id,
      name: "unrelated",
    });

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();

    const aliceNode = page.locator(`.react-flow__node[data-id="${alice.id}"]`);
    const bobNode = page.locator(`.react-flow__node[data-id="${bob.id}"]`);
    const charlieNode = page.locator(
      `.react-flow__node[data-id="${charlie.id}"]`,
    );
    const danaNode = page.locator(`.react-flow__node[data-id="${dana.id}"]`);
    const primaryRail = relationshipRailTrigger(page, "Alice", "Bob");
    const unrelatedRail = relationshipRailTrigger(page, "Charlie", "Dana");

    await expect(primaryRail).toBeVisible();
    await expect(unrelatedRail).toBeVisible();

    await aliceNode.click();
    await expect(charlieNode).toHaveCSS("opacity", "0.25");
    await expect(danaNode).toHaveCSS("opacity", "0.25");
    await expect(bobNode).toHaveCSS("opacity", "1");
    await expect(primaryRail).toHaveAttribute("data-visual-state", "selected");
    await expect(unrelatedRail).toHaveAttribute("data-visual-state", "dimmed");

    await primaryRail.click();
    await expect(page.getByRole("heading", { name: "관계" })).toBeVisible();
    await expect(page.getByText("Alice ↔ Bob")).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Alice → Bob 활성화" }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Bob → Alice 활성화" }),
    ).toBeChecked();
    await expect(primaryRail).toHaveAttribute("data-visual-state", "selected");
    await expect(unrelatedRail).toHaveAttribute("data-visual-state", "dimmed");
    await expect(aliceNode).toHaveCSS("opacity", "1");
    await expect(bobNode).toHaveCSS("opacity", "1");
    await expect(charlieNode).toHaveCSS("opacity", "0.25");
  } finally {
    await cleanupE2EIdentity(identity);
  }
});

test("Graph V2 persists routing and nested properties edited through the Inspector", async ({
  context,
  page,
}) => {
  const identity = await createE2EIdentity("Graph V2 Inspector User");

  try {
    await context.addCookies(identity.cookies);
    const bootstrapResponse = await context.request.get("/api/v1/bootstrap");
    expect(bootstrapResponse.status()).toBe(200);
    const { workspace } = await bootstrapResponse.json();
    const workspaceId = workspace.id as string;

    const story = await createE2EStory(
      context.request,
      workspaceId,
      "Graph V2 Inspector Story",
    );
    const board = await createE2EBoard(
      context.request,
      story.id,
      workspaceId,
      "Inspector Board",
    );
    const alice = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Alice",
      x: 100,
      y: 180,
    });
    const bob = await createE2ENode(context.request, board.id, workspaceId, {
      name: "Bob",
      x: 500,
      y: 180,
    });
    const edge = await createE2EEdge(context.request, board.id, workspaceId, {
      sourceNodeId: alice.id,
      targetNodeId: bob.id,
      name: "knows",
      properties: { profile: "" },
    });

    await page.goto(`/stories/${story.id}/boards/${board.id}`);
    await expect(page.getByLabel("Graph canvas")).toBeVisible();
    await selectRelationshipPair(page, "Alice", "Bob", "knows");
    await page.getByText("고급 설정").click();
    await expect(page.getByLabel("선 모양")).toHaveValue("orthogonal");

    const straightPromise = waitForPatch(
      page,
      `/api/v1/boards/${board.id}/edges/${edge.id}`,
      (payload) => payload.routing?.type === "straight",
    );
    await page.getByLabel("선 모양").selectOption("straight");
    expect((await straightPromise).status()).toBe(200);

    const curvedPromise = waitForPatch(
      page,
      `/api/v1/boards/${board.id}/edges/${edge.id}`,
      (payload) => payload.routing?.type === "curved",
    );
    await page.getByLabel("선 모양").selectOption("curved");
    expect((await curvedPromise).status()).toBe(200);

    const objectPromise = waitForPatch(
      page,
      `/api/v1/boards/${board.id}/edges/${edge.id}`,
      (payload) => getProfileObject(payload) !== null,
    );
    await page.getByLabel("profile 유형").selectOption("object");
    expect((await objectPromise).status()).toBe(200);

    await page.getByLabel("profile 새 속성 키").fill("role");
    const addRolePromise = waitForPatch(
      page,
      `/api/v1/boards/${board.id}/edges/${edge.id}`,
      (payload) => getProfileObject(payload)?.role === "",
    );
    await page.getByRole("button", { name: "profile에 속성 추가" }).click();
    expect((await addRolePromise).status()).toBe(200);

    const rolePromise = waitForPatch(
      page,
      `/api/v1/boards/${board.id}/edges/${edge.id}`,
      (payload) => getProfileObject(payload)?.role === "lead",
    );
    await page.getByLabel("role 값").fill("lead");
    const roleUpdate = await rolePromise;
    expect(roleUpdate.status()).toBe(200);
    await expect(page.getByText("저장됨")).toBeVisible();

    await page.reload();
    await selectRelationshipPair(page, "Alice", "Bob", "knows");
    await page.getByText("고급 설정").click();
    await expect(page.getByLabel("선 모양")).toHaveValue("curved");
    await expect(page.getByLabel("role 값")).toHaveValue("lead");

    const snapshotResponse = await context.request.get(
      `/api/v1/boards/${board.id}/snapshot?workspaceId=${workspaceId}`,
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.edges).toContainEqual(
      expect.objectContaining({
        id: edge.id,
        routing: expect.objectContaining({ type: "curved" }),
        properties: { profile: { role: "lead" } },
      }),
    );
  } finally {
    await cleanupE2EIdentity(identity);
  }
});