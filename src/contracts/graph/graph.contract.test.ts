import { describe, expect, it } from "vitest";

import {
  boardResponseSchema,
  createBoardRequestSchema,
} from "./graph.contract";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
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
});
