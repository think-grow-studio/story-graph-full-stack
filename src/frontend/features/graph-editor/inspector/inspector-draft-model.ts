import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

export type InspectorEntityKey = `node:${string}` | `edge:${string}`;

export type InspectorDraft = {
  name: string;
  description: string;
  propertiesText: string;
  revision: number;
};

export type InspectorDraftPatch = Partial<
  Pick<InspectorDraft, "name" | "description" | "propertiesText">
>;

export type InspectorCanonicalEntity = GraphNodeResponse | GraphEdgeResponse;

export type InspectorDraftEvaluation =
  | {
      status: "saveable";
      dirty: boolean;
      input: {
        name: string;
        description: string;
        properties: Record<string, unknown>;
      };
    }
  | {
      status: "invalid";
      dirty: boolean;
      message:
        | "Name is required."
        | "Properties must be valid JSON."
        | "Properties must be a JSON object.";
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
  return {
    name: entity.name,
    description: entity.description,
    propertiesText: JSON.stringify(entity.properties, null, 2),
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
      dirty: isRawDraftDifferentFromCanonical(draft, entity),
      message: "Name is required.",
    };
  }

  let properties: unknown;
  try {
    properties = JSON.parse(draft.propertiesText);
  } catch {
    return {
      status: "invalid",
      dirty: isRawDraftDifferentFromCanonical(draft, entity),
      message: "Properties must be valid JSON.",
    };
  }

  if (
    properties === null ||
    Array.isArray(properties) ||
    typeof properties !== "object"
  ) {
    return {
      status: "invalid",
      dirty: isRawDraftDifferentFromCanonical(draft, entity),
      message: "Properties must be a JSON object.",
    };
  }

  const input = {
    name: trimmedName,
    description: draft.description,
    properties: properties as Record<string, unknown>,
  };

  return {
    status: "saveable",
    dirty:
      input.name !== entity.name ||
      input.description !== entity.description ||
      !isJsonValueEqual(input.properties, entity.properties),
    input,
  };
}

function isRawDraftDifferentFromCanonical(
  draft: InspectorDraft,
  entity: InspectorCanonicalEntity,
): boolean {
  const canonical = createInspectorDraftFromEntity(entity);
  return (
    draft.name !== canonical.name ||
    draft.description !== canonical.description ||
    draft.propertiesText !== canonical.propertiesText
  );
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
