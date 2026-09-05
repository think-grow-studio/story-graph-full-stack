import { describe, expect, it } from "vitest";

import {
  boardResponseSchema,
  createBoardRequestSchema,
  graphEdgeResponseSchema,
  graphNodeResponseSchema,
  updateNodeRequestSchema,
} from "./graph.contract";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const targetNodeId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-06T00:00:00.000Z";

describe("board-owned graph contracts", () => {
  it("accepts Board responses with tags and without Scope or revision fields", () => {
    const result = boardResponseSchema.safeParse({
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: ["인물", "전체"],
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      id: boardId,
      storyId,
      tags: ["인물", "전체"],
    });
    expect(result.data).not.toHaveProperty("scopeId");
    expect(result.data).not.toHaveProperty("revision");
  });

  it("rejects duplicate Board tags after trimming", () => {
    const result = createBoardRequestSchema.safeParse({
      workspaceId: "workspace-1",
      name: "Characters",
      description: "",
      tags: ["인물", " 인물 "],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a Board-owned Node with semantic and presentation fields in one row", () => {
    const result = graphNodeResponseSchema.safeParse({
      id: nodeId,
      boardId,
      name: "Alice",
      description: "Protagonist",
      iconKey: null,
      properties: { role: "lead" },
      x: 120,
      y: 80,
      width: null,
      height: null,
      zIndex: 0,
      style: { emphasized: true },
      version: 3,
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.boardId).toBe(boardId);
    expect(result.data).not.toHaveProperty("storyId");
    expect(result.data).toMatchObject({ x: 120, y: 80, version: 3 });
  });

  it("uses expectedVersion for Node presentation updates such as movement", () => {
    const result = updateNodeRequestSchema.safeParse({
      workspaceId: "workspace-1",
      expectedVersion: 3,
      x: 240,
      y: 160,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ expectedVersion: 3, x: 240, y: 160 });
    expect(result.data).not.toHaveProperty("version");
  });

  it("accepts a Board-owned Edge with presentation fields in the same row", () => {
    const result = graphEdgeResponseSchema.safeParse({
      id: edgeId,
      boardId,
      sourceNodeId: nodeId,
      targetNodeId,
      name: "knows",
      description: "",
      iconKey: null,
      properties: {},
      style: { dashed: true },
      labelPresentation: { hidden: false },
      version: 2,
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.boardId).toBe(boardId);
    expect(result.data).not.toHaveProperty("storyId");
    expect(result.data.style).toEqual({ dashed: true });
  });
});
