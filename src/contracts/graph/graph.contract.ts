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
const boardTagSchema = z.string().trim().min(1).max(50);
const boardTagsSchema = z.array(boardTagSchema).superRefine((tags, context) => {
  const seen = new Set<string>();
  for (const [index, tag] of tags.entries()) {
    if (seen.has(tag)) {
      context.addIssue({ code: "custom", message: "Board tags must be unique", path: [index] });
      continue;
    }
    seen.add(tag);
  }
});

export const workspaceQuerySchema = z.object({ workspaceId: workspaceIdSchema });

export const createScopeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: nameSchema,
  description: descriptionSchema.default(""),
});

export const createBoardRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: nameSchema,
  description: descriptionSchema.default(""),
  tags: boardTagsSchema.default([]),
  scopeId: graphIdSchema.nullable().optional(),
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

export const placeBoardNodeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  width: positiveNullableNumberSchema.default(null),
  height: positiveNullableNumberSchema.default(null),
  zIndex: z.number().int().default(0),
  style: jsonObjectSchema.default({}),
});

export const putNodeStateRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  version: z.number().int().min(1).nullable(),
  name: nameSchema.nullable(),
  description: descriptionSchema.nullable(),
  properties: jsonObjectSchema.nullable(),
});

export const putEdgeStateRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  version: z.number().int().min(1).nullable(),
  name: nameSchema.nullable(),
  description: descriptionSchema.nullable(),
  properties: jsonObjectSchema.nullable(),
});

export const updateNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: z.number().int().min(1).optional(),
    version: z.number().int().min(1).optional(),
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
  .refine((value) => value.expectedVersion !== undefined || value.version !== undefined, {
    message: "A Node version must be provided",
  })
  .refine(
    (value) =>
      value.name !== undefined || value.description !== undefined ||
      value.iconKey !== undefined || value.properties !== undefined ||
      value.x !== undefined || value.y !== undefined || value.width !== undefined ||
      value.height !== undefined || value.zIndex !== undefined || value.style !== undefined,
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
    (value) => value.x !== undefined || value.y !== undefined || value.width !== undefined ||
      value.height !== undefined || value.zIndex !== undefined || value.style !== undefined,
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
  style: jsonObjectSchema.optional(),
  labelPresentation: jsonObjectSchema.optional(),
});

export const updateEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: z.number().int().min(1).optional(),
    version: z.number().int().min(1).optional(),
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: jsonObjectSchema.optional(),
    style: jsonObjectSchema.optional(),
    labelPresentation: jsonObjectSchema.optional(),
  })
  .refine((value) => value.expectedVersion !== undefined || value.version !== undefined, {
    message: "An Edge version must be provided",
  })
  .refine(
    (value) => value.name !== undefined || value.description !== undefined ||
      value.iconKey !== undefined || value.properties !== undefined ||
      value.style !== undefined || value.labelPresentation !== undefined,
    { message: "At least one Edge field must be provided" },
  );

export const restoreBoardEdgeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  style: jsonObjectSchema.default({}),
  labelPresentation: jsonObjectSchema.default({}),
});

const restoreBoardNodeEdgePresentationSchema = z.object({
  edgeId: graphIdSchema,
  style: jsonObjectSchema.default({}),
  labelPresentation: jsonObjectSchema.default({}),
});

export const restoreBoardNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: positiveNullableNumberSchema.default(null),
    height: positiveNullableNumberSchema.default(null),
    zIndex: z.number().int().default(0),
    style: jsonObjectSchema.default({}),
    boardEdges: z.array(restoreBoardNodeEdgePresentationSchema).default([]),
  })
  .refine(
    (value) => new Set(value.boardEdges.map((boardEdge) => boardEdge.edgeId)).size === value.boardEdges.length,
    { message: "BoardEdge ids must be unique", path: ["boardEdges"] },
  );

export const scopeResponseSchema = z.object({
  id: graphIdSchema,
  storyId: graphIdSchema,
  name: z.string(),
  description: z.string(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const nodeStateResponseSchema = z.object({
  scopeId: graphIdSchema,
  nodeId: graphIdSchema,
  name: z.string().nullable(),
  description: z.string().nullable(),
  properties: jsonObjectSchema.nullable(),
  version: z.number().int().min(1),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const edgeStateResponseSchema = z.object({
  scopeId: graphIdSchema,
  edgeId: graphIdSchema,
  name: z.string().nullable(),
  description: z.string().nullable(),
  properties: jsonObjectSchema.nullable(),
  version: z.number().int().min(1),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const boardResponseSchema = z.object({
  id: graphIdSchema,
  storyId: graphIdSchema,
  scopeId: graphIdSchema.nullable().optional(),
  name: z.string(),
  description: z.string(),
  tags: boardTagsSchema.optional(),
  revision: z.number().int().min(0).optional(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const listScopesResponseSchema = z.object({ scopes: z.array(scopeResponseSchema) });
export const listBoardsResponseSchema = z.object({ boards: z.array(boardResponseSchema) });

export const graphNodeResponseSchema = z.object({
  id: graphIdSchema,
  boardId: graphIdSchema.optional(),
  storyId: graphIdSchema.optional(),
  name: z.string(),
  description: z.string(),
  iconKey: z.string().nullable(),
  properties: jsonObjectSchema,
  x: finiteNumberSchema.optional(),
  y: finiteNumberSchema.optional(),
  width: positiveNullableNumberSchema.optional(),
  height: positiveNullableNumberSchema.optional(),
  zIndex: z.number().int().optional(),
  style: jsonObjectSchema.optional(),
  version: z.number().int().min(1),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const listStoryNodesResponseSchema = z.object({ nodes: z.array(graphNodeResponseSchema) });

export const graphEdgeResponseSchema = z.object({
  id: graphIdSchema,
  boardId: graphIdSchema.optional(),
  storyId: graphIdSchema.optional(),
  sourceNodeId: graphIdSchema,
  targetNodeId: graphIdSchema,
  name: z.string(),
  description: z.string(),
  iconKey: z.string().nullable(),
  properties: jsonObjectSchema,
  style: jsonObjectSchema.optional(),
  labelPresentation: jsonObjectSchema.optional(),
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

export const createNodeResponseSchema = z.object({ node: graphNodeResponseSchema, boardNode: boardNodeResponseSchema });
export const createEdgeResponseSchema = z.object({ edge: graphEdgeResponseSchema, boardEdge: boardEdgeResponseSchema });
export const restoreBoardNodeResponseSchema = z.object({
  node: graphNodeResponseSchema,
  boardNode: boardNodeResponseSchema,
  edges: z.array(graphEdgeResponseSchema),
  boardEdges: z.array(boardEdgeResponseSchema),
});

export const boardSnapshotResponseSchema = z.object({
  story: z.object({ id: graphIdSchema, name: z.string() }),
  board: boardResponseSchema,
  scope: scopeResponseSchema.nullable(),
  nodes: z.array(graphNodeResponseSchema),
  nodeStates: z.array(nodeStateResponseSchema),
  edges: z.array(graphEdgeResponseSchema),
  edgeStates: z.array(edgeStateResponseSchema),
  boardNodes: z.array(boardNodeResponseSchema),
  boardEdges: z.array(boardEdgeResponseSchema),
});

export type ScopeResponse = z.infer<typeof scopeResponseSchema>;
export type NodeStateResponse = z.infer<typeof nodeStateResponseSchema>;
export type EdgeStateResponse = z.infer<typeof edgeStateResponseSchema>;
export type BoardResponse = z.infer<typeof boardResponseSchema>;
export type GraphNodeResponse = z.infer<typeof graphNodeResponseSchema>;
export type GraphEdgeResponse = z.infer<typeof graphEdgeResponseSchema>;
export type BoardNodeResponse = z.infer<typeof boardNodeResponseSchema>;
export type BoardEdgeResponse = z.infer<typeof boardEdgeResponseSchema>;
export type BoardSnapshotResponse = z.infer<typeof boardSnapshotResponseSchema>;
export type CreateScopeRequest = z.infer<typeof createScopeRequestSchema>;
export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>;
export type CreateNodeRequest = z.infer<typeof createNodeRequestSchema>;
export type PlaceBoardNodeRequest = z.infer<typeof placeBoardNodeRequestSchema>;
export type PutNodeStateRequest = z.infer<typeof putNodeStateRequestSchema>;
export type PutEdgeStateRequest = z.infer<typeof putEdgeStateRequestSchema>;
export type UpdateBoardNodeRequest = z.infer<typeof updateBoardNodeRequestSchema>;
export type RestoreBoardEdgeRequest = z.infer<typeof restoreBoardEdgeRequestSchema>;
export type RestoreBoardNodeRequest = z.infer<typeof restoreBoardNodeRequestSchema>;
export type RestoreBoardNodeResponse = z.infer<typeof restoreBoardNodeResponseSchema>;
