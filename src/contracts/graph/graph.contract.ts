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

export const workspaceQuerySchema = z.object({ workspaceId: workspaceIdSchema });

export const createBoardRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: nameSchema,
  description: descriptionSchema.default(""),
});

export const createNodeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: graphIdSchema,
  name: nameSchema,
  description: descriptionSchema.default(""),
  iconKey: iconKeySchema.default(null),
  properties: jsonObjectSchema.default({}),
  position: z.object({ x: finiteNumberSchema, y: finiteNumberSchema }),
  width: positiveNullableNumberSchema.default(null),
  height: positiveNullableNumberSchema.default(null),
  zIndex: z.number().int().default(0),
  style: jsonObjectSchema.default({}),
});

export const updateNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    version: z.number().int().min(1),
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: jsonObjectSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined,
    { message: "At least one Node field must be provided" },
  );

export const updateBoardNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    x: finiteNumberSchema.optional(),
    y: finiteNumberSchema.optional(),
    width: positiveNullableNumberSchema.optional(),
    height: positiveNullableNumberSchema.optional(),
    zIndex: z.number().int().optional(),
    style: jsonObjectSchema.optional(),
  })
  .refine(
    (value) =>
      value.x !== undefined ||
      value.y !== undefined ||
      value.width !== undefined ||
      value.height !== undefined ||
      value.zIndex !== undefined ||
      value.style !== undefined,
    { message: "At least one BoardNode field must be provided" },
  );

export const createEdgeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: graphIdSchema,
  sourceNodeId: graphIdSchema,
  targetNodeId: graphIdSchema,
  name: nameSchema,
  description: descriptionSchema.default(""),
  iconKey: iconKeySchema.default(null),
  properties: jsonObjectSchema.default({}),
});

export const updateEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    version: z.number().int().min(1),
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: jsonObjectSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined,
    { message: "At least one Edge field must be provided" },
  );

export const restoreBoardEdgeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  style: jsonObjectSchema.default({}),
  labelPresentation: jsonObjectSchema.default({}),
});

export const boardResponseSchema = z.object({
  id: graphIdSchema,
  storyId: graphIdSchema,
  name: z.string(),
  description: z.string(),
  revision: z.number().int().min(0),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const listBoardsResponseSchema = z.object({
  boards: z.array(boardResponseSchema),
});

export const graphNodeResponseSchema = z.object({
  id: graphIdSchema,
  storyId: graphIdSchema,
  name: z.string(),
  description: z.string(),
  iconKey: z.string().nullable(),
  properties: jsonObjectSchema,
  version: z.number().int().min(1),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const graphEdgeResponseSchema = z.object({
  id: graphIdSchema,
  storyId: graphIdSchema,
  sourceNodeId: graphIdSchema,
  targetNodeId: graphIdSchema,
  name: z.string(),
  description: z.string(),
  iconKey: z.string().nullable(),
  properties: jsonObjectSchema,
  version: z.number().int().min(1),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const boardNodeResponseSchema = z.object({
  boardId: graphIdSchema,
  nodeId: graphIdSchema,
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  width: positiveNullableNumberSchema,
  height: positiveNullableNumberSchema,
  zIndex: z.number().int(),
  style: jsonObjectSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const boardEdgeResponseSchema = z.object({
  boardId: graphIdSchema,
  edgeId: graphIdSchema,
  style: jsonObjectSchema,
  labelPresentation: jsonObjectSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const createNodeResponseSchema = z.object({
  node: graphNodeResponseSchema,
  boardNode: boardNodeResponseSchema,
});

export const createEdgeResponseSchema = z.object({
  edge: graphEdgeResponseSchema,
  boardEdge: boardEdgeResponseSchema,
});

export const boardSnapshotResponseSchema = z.object({
  story: z.object({ id: graphIdSchema, name: z.string() }),
  board: boardResponseSchema,
  nodes: z.array(graphNodeResponseSchema),
  edges: z.array(graphEdgeResponseSchema),
  boardNodes: z.array(boardNodeResponseSchema),
  boardEdges: z.array(boardEdgeResponseSchema),
});

export type BoardResponse = z.infer<typeof boardResponseSchema>;
export type GraphNodeResponse = z.infer<typeof graphNodeResponseSchema>;
export type GraphEdgeResponse = z.infer<typeof graphEdgeResponseSchema>;
export type BoardNodeResponse = z.infer<typeof boardNodeResponseSchema>;
export type BoardEdgeResponse = z.infer<typeof boardEdgeResponseSchema>;
export type BoardSnapshotResponse = z.infer<typeof boardSnapshotResponseSchema>;
export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>;
export type CreateNodeRequest = z.infer<typeof createNodeRequestSchema>;
export type UpdateBoardNodeRequest = z.infer<typeof updateBoardNodeRequestSchema>;
export type RestoreBoardEdgeRequest = z.infer<typeof restoreBoardEdgeRequestSchema>;
