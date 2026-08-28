import { z } from "zod";

const entityIdSchema = z.uuid();
const workspaceIdSchema = z.string().min(1);
const entityNameSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().max(10_000);
const iconKeySchema = z.string().trim().min(1).max(100).nullable();
const propertiesSchema = z.record(z.string(), z.json());
const versionSchema = z.number().int().positive();

const graphEntityFields = {
  name: entityNameSchema,
  description: descriptionSchema,
  iconKey: iconKeySchema,
  properties: propertiesSchema,
};

export const graphNodeResponseSchema = z.object({
  id: entityIdSchema,
  storyId: z.string().min(1),
  ...graphEntityFields,
  version: versionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const graphEdgeResponseSchema = z.object({
  id: entityIdSchema,
  storyId: z.string().min(1),
  sourceNodeId: entityIdSchema,
  targetNodeId: entityIdSchema,
  ...graphEntityFields,
  version: versionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const graphWorkspaceQuerySchema = z.object({
  workspaceId: workspaceIdSchema,
});

export const createGraphNodeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: entityIdSchema,
  name: entityNameSchema,
  description: descriptionSchema.default(""),
  iconKey: iconKeySchema.default(null),
  properties: propertiesSchema.default({}),
});

export const updateGraphNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: versionSchema,
    name: entityNameSchema.optional(),
    description: descriptionSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: propertiesSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined,
    { message: "At least one Node field must be updated" },
  );

export const listGraphNodesResponseSchema = z.object({
  nodes: z.array(graphNodeResponseSchema),
});

export const createGraphEdgeRequestSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: entityIdSchema,
  sourceNodeId: entityIdSchema,
  targetNodeId: entityIdSchema,
  name: entityNameSchema,
  description: descriptionSchema.default(""),
  iconKey: iconKeySchema.default(null),
  properties: propertiesSchema.default({}),
});

export const updateGraphEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: versionSchema,
    name: entityNameSchema.optional(),
    description: descriptionSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: propertiesSchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined,
    { message: "At least one Edge field must be updated" },
  );

export const listGraphEdgesResponseSchema = z.object({
  edges: z.array(graphEdgeResponseSchema),
});

export type GraphNodeResponse = z.infer<typeof graphNodeResponseSchema>;
export type GraphEdgeResponse = z.infer<typeof graphEdgeResponseSchema>;
export type CreateGraphNodeRequest = z.infer<typeof createGraphNodeRequestSchema>;
export type UpdateGraphNodeRequest = z.infer<typeof updateGraphNodeRequestSchema>;
export type CreateGraphEdgeRequest = z.infer<typeof createGraphEdgeRequestSchema>;
export type UpdateGraphEdgeRequest = z.infer<typeof updateGraphEdgeRequestSchema>;
