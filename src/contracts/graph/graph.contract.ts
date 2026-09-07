import { z } from "zod";

export type GraphPropertyValue =
  | string
  | GraphPropertyValue[]
  | { [key: string]: GraphPropertyValue };
export type GraphProperties = Record<string, GraphPropertyValue>;

export const defaultGraphSettings = {
  defaultEdgeRouting: "orthogonal",
  snapToGrid: false,
  layoutMode: "free",
} as const;

export const defaultNodePresentation = {
  shape: "rounded-rect",
  fillColor: null,
  borderColor: null,
  borderWidth: null,
  textColor: null,
} as const;

export const defaultEdgePresentation = {
  strokeColor: null,
  strokeWidth: null,
  strokeStyle: "solid",
  labelColor: null,
} as const;

export const defaultEdgeRouting = {
  type: "orthogonal",
  sourcePort: "auto",
  targetPort: "auto",
  waypoints: [],
} as const;

export const graphIdSchema = z.string().uuid();
export const finiteNumberSchema = z.number().finite();
export const positiveNullableNumberSchema = z
  .number()
  .finite()
  .positive()
  .nullable();

const workspaceIdSchema = z.string().min(1);
const nameSchema = z.string().trim().min(1).max(200);
const kindSchema = z.string().trim().min(1).max(100);
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

const propertyKeySchema = z
  .string()
  .min(1)
  .max(100)
  .refine(
    (value) => value === value.trim() && value.trim().length > 0,
    "Property keys must be trimmed and non-empty",
  );
const propertyScalarSchema = z.string().max(10_000);

const graphPropertyValueSchema: z.ZodType<GraphPropertyValue> = z.lazy(() =>
  z.union([
    propertyScalarSchema,
    z.array(graphPropertyValueSchema),
    z.record(propertyKeySchema, graphPropertyValueSchema),
  ]),
);

function validatePropertyComplexity(
  properties: GraphProperties,
  context: z.RefinementCtx,
) {
  let totalEntries = 0;
  let failed = false;

  function visit(value: GraphPropertyValue, depth: number, path: PropertyKey[]) {
    if (failed) return;
    if (depth > 6) {
      context.addIssue({
        code: "custom",
        message: "Graph properties may be nested at most 6 levels",
        path,
      });
      failed = true;
      return;
    }
    if (typeof value === "string") return;

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        totalEntries += 1;
        if (totalEntries > 200) {
          context.addIssue({
            code: "custom",
            message: "Graph properties may contain at most 200 entries",
            path: [...path, index],
          });
          failed = true;
          return;
        }
        visit(item, depth + 1, [...path, index]);
      }
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      totalEntries += 1;
      if (totalEntries > 200) {
        context.addIssue({
          code: "custom",
          message: "Graph properties may contain at most 200 entries",
          path: [...path, key],
        });
        failed = true;
        return;
      }
      visit(item, depth + 1, [...path, key]);
    }
  }

  for (const [key, value] of Object.entries(properties)) {
    totalEntries += 1;
    if (totalEntries > 200) {
      context.addIssue({
        code: "custom",
        message: "Graph properties may contain at most 200 entries",
        path: [key],
      });
      return;
    }
    visit(value, 1, [key]);
  }
}

type PropertyKey = string | number;

export const graphPropertiesSchema: z.ZodType<GraphProperties> = z
  .record(propertyKeySchema, graphPropertyValueSchema)
  .superRefine(validatePropertyComplexity);

export const graphSettingsSchema = z
  .object({
    defaultEdgeRouting: z.enum(["orthogonal", "straight", "curved"]),
    snapToGrid: z.boolean(),
    layoutMode: z.literal("free"),
  })
  .strict();

const colorValueSchema = z.string().max(100).nullable();

export const nodePresentationSchema = z
  .object({
    shape: z.enum(["rounded-rect", "rect", "ellipse", "diamond"]),
    fillColor: colorValueSchema,
    borderColor: colorValueSchema,
    borderWidth: z.number().finite().min(0).max(20).nullable(),
    textColor: colorValueSchema,
  })
  .strict();

export const edgeDirectionSchema = z.enum(["DIRECTED", "UNDIRECTED"]);

export const edgePresentationSchema = z
  .object({
    strokeColor: colorValueSchema,
    strokeWidth: z.number().finite().positive().max(20).nullable(),
    strokeStyle: z.enum(["solid", "dashed", "dotted"]),
    labelColor: colorValueSchema,
  })
  .strict();

export const edgeRoutingSchema = z
  .object({
    type: z.enum(["orthogonal", "straight", "curved"]),
    sourcePort: z.enum(["auto", "top", "right", "bottom", "left"]),
    targetPort: z.enum(["auto", "top", "right", "bottom", "left"]),
    waypoints: z
      .array(
        z
          .object({ x: finiteNumberSchema, y: finiteNumberSchema })
          .strict(),
      )
      .max(64),
  })
  .strict();

export const workspaceQuerySchema = z
  .object({ workspaceId: workspaceIdSchema })
  .strict();

export const createBoardRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    name: nameSchema,
    description: descriptionSchema.default(""),
    tags: boardTagsSchema.default([]),
    graphSettings: graphSettingsSchema.default({ ...defaultGraphSettings }),
  })
  .strict();

export const updateBoardRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    tags: boardTagsSchema.optional(),
    graphSettings: graphSettingsSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.tags !== undefined ||
      value.graphSettings !== undefined,
    { message: "At least one Board field must be provided" },
  );

export const createNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    id: graphIdSchema,
    name: nameSchema,
    description: descriptionSchema.default(""),
    kind: kindSchema.default("entity"),
    iconKey: iconKeySchema.default(null),
    properties: graphPropertiesSchema.default({}),
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: positiveNullableNumberSchema.default(null),
    height: positiveNullableNumberSchema.default(null),
    zIndex: z.number().int().default(0),
    presentation: nodePresentationSchema.default({ ...defaultNodePresentation }),
  })
  .strict();

export const updateNodeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: versionSchema,
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    kind: kindSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: graphPropertiesSchema.optional(),
    x: finiteNumberSchema.optional(),
    y: finiteNumberSchema.optional(),
    width: positiveNullableNumberSchema.optional(),
    height: positiveNullableNumberSchema.optional(),
    zIndex: z.number().int().optional(),
    presentation: nodePresentationSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.kind !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined ||
      value.x !== undefined ||
      value.y !== undefined ||
      value.width !== undefined ||
      value.height !== undefined ||
      value.zIndex !== undefined ||
      value.presentation !== undefined,
    { message: "At least one Node field must be provided" },
  );

export const createEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    id: graphIdSchema,
    sourceNodeId: graphIdSchema,
    targetNodeId: graphIdSchema,
    direction: edgeDirectionSchema,
    name: nameSchema,
    description: descriptionSchema.default(""),
    kind: kindSchema.default("relationship"),
    iconKey: iconKeySchema.default(null),
    properties: graphPropertiesSchema.default({}),
    presentation: edgePresentationSchema.default({ ...defaultEdgePresentation }),
    routing: edgeRoutingSchema,
  })
  .strict();

export const updateEdgeRequestSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    expectedVersion: versionSchema,
    direction: edgeDirectionSchema.optional(),
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    kind: kindSchema.optional(),
    iconKey: iconKeySchema.optional(),
    properties: graphPropertiesSchema.optional(),
    presentation: edgePresentationSchema.optional(),
    routing: edgeRoutingSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.direction !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.kind !== undefined ||
      value.iconKey !== undefined ||
      value.properties !== undefined ||
      value.presentation !== undefined ||
      value.routing !== undefined,
    { message: "At least one Edge field must be provided" },
  );

const restorableNodeSchema = z
  .object({
    id: graphIdSchema,
    boardId: graphIdSchema,
    name: nameSchema,
    description: descriptionSchema,
    kind: kindSchema,
    iconKey: iconKeySchema,
    properties: graphPropertiesSchema,
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: positiveNullableNumberSchema,
    height: positiveNullableNumberSchema,
    zIndex: z.number().int(),
    presentation: nodePresentationSchema,
    version: versionSchema,
  })
  .strict();

const restorableEdgeSchema = z
  .object({
    id: graphIdSchema,
    boardId: graphIdSchema,
    sourceNodeId: graphIdSchema,
    targetNodeId: graphIdSchema,
    direction: edgeDirectionSchema,
    name: nameSchema,
    description: descriptionSchema,
    kind: kindSchema,
    iconKey: iconKeySchema,
    properties: graphPropertiesSchema,
    presentation: edgePresentationSchema,
    routing: edgeRoutingSchema,
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
      if (
        edge.sourceNodeId !== value.node.id &&
        edge.targetNodeId !== value.node.id
      ) {
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
    graphSettings: graphSettingsSchema,
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
    kind: kindSchema,
    iconKey: z.string().nullable(),
    properties: graphPropertiesSchema,
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: positiveNullableNumberSchema,
    height: positiveNullableNumberSchema,
    zIndex: z.number().int(),
    presentation: nodePresentationSchema,
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
    direction: edgeDirectionSchema,
    name: z.string(),
    description: z.string(),
    kind: kindSchema,
    iconKey: z.string().nullable(),
    properties: graphPropertiesSchema,
    presentation: edgePresentationSchema,
    routing: edgeRoutingSchema,
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

export type GraphSettings = z.infer<typeof graphSettingsSchema>;
export type NodePresentation = z.infer<typeof nodePresentationSchema>;
export type EdgeDirection = z.infer<typeof edgeDirectionSchema>;
export type EdgePresentation = z.infer<typeof edgePresentationSchema>;
export type EdgeRouting = z.infer<typeof edgeRoutingSchema>;
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
