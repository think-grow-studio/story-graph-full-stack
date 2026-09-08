import {
  graphPropertiesSchema,
  type GraphEdgeResponse,
  type GraphNodeResponse,
  type GraphProperties,
} from "@/contracts/graph/graph.contract";
import type { SaveState } from "../save-queue/save-state";

export type InspectorEntityKey = `node:${string}` | `edge:${string}`;

type EdgeDirection = GraphEdgeResponse["direction"];
type EdgeRoutingType = GraphEdgeResponse["routing"]["type"];

export type InspectorDraft = {
  name: string;
  description: string;
  kind: string;
  properties: GraphProperties;
  direction: EdgeDirection | null;
  routingType: EdgeRoutingType | null;
  revision: number;
};

export type InspectorDraftPatch = Partial<
  Pick<
    InspectorDraft,
    | "name"
    | "description"
    | "kind"
    | "properties"
    | "direction"
    | "routingType"
  >
>;

export type InspectorCanonicalEntity = GraphNodeResponse | GraphEdgeResponse;

export type InspectorDraftEvaluation =
  | {
      status: "saveable";
      dirty: boolean;
      input: {
        name: string;
        description: string;
        kind: string;
        properties: GraphProperties;
      };
    }
  | {
      status: "invalid";
      dirty: boolean;
      message:
        | "Name is required."
        | "Kind is required."
        | "Properties do not match the Graph property rules.";
    };

export function toInspectorEntityKey(
  kind: "node" | "edge",
  id: string,
): InspectorEntityKey {
  return `${kind}:${id}`;
}

export function createInspectorDraftFromEntity(
  entity: InspectorCanonicalEntity,
): InspectorDraft {
  const edge = isEdgeEntity(entity) ? entity : null;
  return {
    name: entity.name,
    description: entity.description,
    kind: entity.kind,
    properties: entity.properties,
    direction: edge?.direction ?? null,
    routingType: edge?.routing.type ?? null,
    revision: 0,
  };
}

export function evaluateInspectorDraft(
  draft: InspectorDraft,
  entity: InspectorCanonicalEntity,
): InspectorDraftEvaluation {
  const trimmedName = draft.name.trim();
  if (!trimmedName) {
    return {
      status: "invalid",
      dirty: isDraftDifferentFromCanonical(draft, entity),
      message: "Name is required.",
    };
  }

  const trimmedKind = draft.kind.trim();
  if (!trimmedKind) {
    return {
      status: "invalid",
      dirty: isDraftDifferentFromCanonical(draft, entity),
      message: "Kind is required.",
    };
  }

  const parsedProperties = graphPropertiesSchema.safeParse(draft.properties);
  if (!parsedProperties.success) {
    return {
      status: "invalid",
      dirty: isDraftDifferentFromCanonical(draft, entity),
      message: "Properties do not match the Graph property rules.",
    };
  }

  const input = {
    name: trimmedName,
    description: draft.description,
    kind: trimmedKind,
    properties: parsedProperties.data,
  };

  const edgeDirty =
    isEdgeEntity(entity) &&
    (draft.direction !== entity.direction || draft.routingType !== entity.routing.type);

  return {
    status: "saveable",
    dirty:
      input.name !== entity.name ||
      input.description !== entity.description ||
      input.kind !== entity.kind ||
      !isJsonValueEqual(input.properties, entity.properties) ||
      edgeDirty,
    input,
  };
}

export function areInspectorDraftValuesEqual(
  left: InspectorDraft,
  right: InspectorDraft,
): boolean {
  return (
    left.name === right.name &&
    left.description === right.description &&
    left.kind === right.kind &&
    left.direction === right.direction &&
    left.routingType === right.routingType &&
    isJsonValueEqual(left.properties, right.properties)
  );
}

export function combineEditorSaveState(
  queueState: SaveState,
  hasDirtyInspectorDraft: boolean,
): SaveState {
  if (queueState === "error") return "error";
  if (queueState === "saving") return "saving";
  if (queueState === "unsaved") return "unsaved";
  return hasDirtyInspectorDraft ? "unsaved" : "saved";
}

function isDraftDifferentFromCanonical(
  draft: InspectorDraft,
  entity: InspectorCanonicalEntity,
): boolean {
  return !areInspectorDraftValuesEqual(draft, createInspectorDraftFromEntity(entity));
}

function isEdgeEntity(
  entity: InspectorCanonicalEntity,
): entity is GraphEdgeResponse {
  return "routing" in entity;
}

function isJsonValueEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => isJsonValueEqual(value, right[index]));
  }

  if (!isRecord(left) || !isRecord(right)) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      isJsonValueEqual(left[key], right[key]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
