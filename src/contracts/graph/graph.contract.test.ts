import { describe, expect, it } from "vitest";

import {
  boardResponseSchema,
  boardSnapshotResponseSchema,
  createNodeRequestSchema,
  graphNodeResponseSchema,
  updateNodeRequestSchema,
} from "./graph.contract";

const boardId = "11111111-1111-4111-8111-111111111111";
const storyId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-06T00:00:00.000Z";

describe("Board-owned Graph contracts", () => {
  it("exposes Board tags without Scope or revision fields", () => {
    const board = boardResponseSchema.parse({
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: ["인물", "전체"],
      createdAt: now,
      updatedAt: now,
    });

    expect(board).toEqual({
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: ["인물", "전체"],
      createdAt: now,
      updatedAt: now,
    });
  });

  it("requires direct Board ownership and presentation on Node responses", () => {
    expect(() =>
      graphNodeResponseSchema.parse({
        id: nodeId,
        name: "Alice",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();

    expect(
      graphNodeResponseSchema.parse({
        id: nodeId,
        boardId,
        name: "Alice",
        description: "",
        iconKey: null,
        properties: {},
        x: 120,
        y: 180,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    ).toMatchObject({ boardId, x: 120, y: 180 });
  });

  it("uses direct Node create fields instead of a position wrapper", () => {
    expect(
      createNodeRequestSchema.parse({
        workspaceId: "workspace-1",
        id: nodeId,
        name: "Alice",
        x: 10,
        y: 20,
      }),
    ).toMatchObject({ x: 10, y: 20 });

    expect(() =>
      createNodeRequestSchema.parse({
        workspaceId: "workspace-1",
        id: nodeId,
        name: "Alice",
        position: { x: 10, y: 20 },
      }),
    ).toThrow();
  });

  it("requires expectedVersion instead of the legacy version alias", () => {
    expect(
      updateNodeRequestSchema.parse({
        workspaceId: "workspace-1",
        expectedVersion: 1,
        name: "Alicia",
      }),
    ).toMatchObject({ expectedVersion: 1, name: "Alicia" });

    expect(() =>
      updateNodeRequestSchema.parse({
        workspaceId: "workspace-1",
        version: 1,
        name: "Alicia",
      }),
    ).toThrow();
  });

  it("parses a direct Board snapshot with only story, Board, Nodes and Edges", () => {
    const story = { id: storyId, name: "Novel" };
    const board = boardResponseSchema.parse({
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
    const node = graphNodeResponseSchema.parse({
      id: nodeId,
      boardId,
      name: "Alice",
      description: "",
      iconKey: null,
      properties: {},
      x: 10,
      y: 20,
      width: null,
      height: null,
      zIndex: 0,
      style: {},
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    expect(
      boardSnapshotResponseSchema.parse({
        story,
        board,
        nodes: [node],
        edges: [],
      }),
    ).toEqual({ story, board, nodes: [node], edges: [] });
  });
});
