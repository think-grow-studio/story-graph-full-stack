import { z } from "zod";

export const graphIdSchema = z.string().uuid();
export const jsonObjectSchema = z.record(z.string(), z.unknown());
export const finiteNumberSchema = z.number().finite();
export const positiveNullableNumberSchema = z.number().finite().positive().nullable();

const workspaceIdSchema = z.string().min(1);
const nameSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().max(10_000);
const iconKeySchema = z.string().min(1).max(200).nullable();
const dateTimeSchema = z.iso.datetime();
const versionSchema = z.number().int().min(1);
const boardTagSchema = z.string().trim().min(1).max(50);
const boardTagsSchema = z.array(boardTagSchema).superRefine((tags, context) => {
  const seen = new Set<string>();
  for (const [index, tag] of tags.entries()) {
    if (seen.has(tag)) {
      context.addIssue({
        code: "custom",
        message: "Board tags must be unique",
        path: [index],
      });
      continue;
    }
    seen.add(tag);
  }
});

export const workspaceQuerySchema = z.object({ workspaceId: workspaceIdSchema }).strict();

export const createBoardRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    name: nameSchema,
    description: descriptionSchema.default(""),
    tags: boardTagsSchema.default([]),
  })
  .strict();

export const updateBoardRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    tags: boardTagsSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.tags !== undefined,
    { message: "At least one Board field must be provided" },
  );

export const createNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    id: graphIdSchema,
    name: nameSchema,
    description: descriptionSchema.default(""),
    iconKey: iconKeySchema.default(null),
    properties: jsonObjectSchema.default({}),
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: positiveNullableNumberSchema.default(null),
    height: positiveNullableNumberSchema.default(null),
    zIndex: z.number().int().default(0),
    style: jsonObjectSchema.default({}),
  })
  .strict();

export const updateNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: jsonObjectSchema.optional(),
    x: finiteNumberSchema.optional(),
    y: finiteNumberSchema.optional(),
    width: positiveNullableNumberSchema.optional(),
    height: positiveNullableNumberSchema.optional(),
    zIndex: z.number().int().optional(),
    style: jsonObjectSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined ||
      value.x !== undefined ||
      value.y !== undefined ||
      value.width !== undefined ||
      value.height !== undefined ||
      value.zIndex !== undefined ||
      value.style !== undefined,
    { message: "At least one Node field must be provided" },
  );

export const createEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    id: graphIdSchema,
    sourceNodeId: graphIdSchema,
    targetNodeId: graphIdSchema,
    name: nameSchema,
    description: descriptionSchema.default(""),
    iconKey: iconKeySchema.default(null),
    properties: jsonObjectSchema.default({}),
    style: jsonObjectSchema.default({}),
    labelPresentation: jsonObjectSchema.default({}),
  })
  .strict();

export const updateEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: jsonObjectSchema.optional(),
    style: jsonObjectSchema.optional(),
    labelPresentation: jsonObjectSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined ||
      value.style !== undefined ||
      value.labelPresentation !== undefined,
    { message: "At least one Edge field must be provided" },
  );

const restorableNodeSchema = z
  .object({
    id: graphIdSchema,
    boardId: graphIdSchema,
    name: nameSchema,
    description: descriptionSchema,
    iconKey: iconKeySchema,
    properties: jsonObjectSchema,
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: positiveNullableNumberSchema,
    height: positiveNullableNumberSchema,
    zIndex: z.number().int(),
    style: jsonObjectSchema,
    version: versionSchema,
  })
  .strict();

const restorableEdgeSchema = z
  .object({
    id: graphIdSchema,
    boardId: graphIdSchema,
    sourceNodeId: graphIdSchema,
    targetNodeId: graphIdSchema,
    name: nameSchema,
    description: descriptionSchema,
    iconKey: iconKeySchema,
    properties: jsonObjectSchema,
    style: jsonObjectSchema,
    labelPresentation: jsonObjectSchema,
    version: versionSchema,
  })
  .strict();

export const restoreNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    node: restorableNodeSchema,
    edges: z.array(restorableEdgeSchema).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const edgeIds = new Set<string>();
    for (const [index, edge] of value.edges.entries()) {
      if (edgeIds.has(edge.id)) {
        context.addIssue({
          code: "custom",
          message: "Restored Edge ids must be unique",
          path: ["edges", index, "id"],
        });
      }
      edgeIds.add(edge.id);
      if (edge.boardId !== value.node.boardId) {
        context.addIssue({
          code: "custom",
          message: "Restored Edges must belong to the restored Node Board",
          path: ["edges", index, "boardId"],
        });
      }
      if (edge.sourceNodeId !== value.node.id && edge.targetNodeId !== value.node.id) {
        context.addIssue({
          code: "custom",
          message: "Restored Edges must be incident to the restored Node",
          path: ["edges", index],
        });
      }
    }
  });

export const restoreEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    edge: restorableEdgeSchema,
  })
  .strict();

export const boardResponseSchema = z
  .object({
    id: graphIdSchema,
    storyId: graphIdSchema,
    name: z.string(),
    description: z.string(),
    tags: boardTagsSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .strict();

export const listBoardsResponseSchema = z
  .object({ boards: z.array(boardResponseSchema) })
  .strict();

export const graphNodeResponseSchema = z
  .object({
    id: graphIdSchema,
    boardId: graphIdSchema,
    name: z.string(),
    description: z.string(),
    iconKey: z.string().nullable(),
    properties: jsonObjectSchema,
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: positiveNullableNumberSchema,
    height: positiveNullableNumberSchema,
    zIndex: z.number().int(),
    style: jsonObjectSchema,
    version: versionSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .strict();

export const graphEdgeResponseSchema = z
  .object({
    id: graphIdSchema,
    boardId: graphIdSchema,
    sourceNodeId: graphIdSchema,
    targetNodeId: graphIdSchema,
    name: z.string(),
    description: z.string(),
    iconKey: z.string().nullable(),
    properties: jsonObjectSchema,
    style: jsonObjectSchema,
    labelPresentation: jsonObjectSchema,
    version: versionSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .strict();

export const boardSnapshotResponseSchema = z
  .object({
    story: z.object({ id: graphIdSchema, name: z.string() }).strict(),
    board: boardResponseSchema,
    nodes: z.array(graphNodeResponseSchema),
    edges: z.array(graphEdgeResponseSchema),
  })
  .strict();

export const restoreNodeResponseSchema = z
  .object({
    node: graphNodeResponseSchema,
    edges: z.array(graphEdgeResponseSchema),
  })
  .strict();

export type BoardResponse = z.infer<typeof boardResponseSchema>;
export type GraphNodeResponse = z.infer<typeof graphNodeResponseSchema>;
export type GraphEdgeResponse = z.infer<typeof graphEdgeResponseSchema>;
export type BoardSnapshotResponse = z.infer<typeof boardSnapshotResponseSchema>;
export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>;
export type UpdateBoardRequest = z.infer<typeof updateBoardRequestSchema>;
export type CreateNodeRequest = z.infer<typeof createNodeRequestSchema>;
export type UpdateNodeRequest = z.infer<typeof updateNodeRequestSchema>;
export type CreateEdgeRequest = z.infer<typeof createEdgeRequestSchema>;
export type UpdateEdgeRequest = z.infer<typeof updateEdgeRequestSchema>;
export type RestoreNodeRequest = z.infer<typeof restoreNodeRequestSchema>;
export type RestoreEdgeRequest = z.infer<typeof restoreEdgeRequestSchema>;
export type RestoreNodeResponse = z.infer<typeof restoreNodeResponseSchema>;
