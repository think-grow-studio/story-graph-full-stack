import type {
  GraphNodeResponse,
  NodeStateResponse,
} from "@/contracts/graph/graph.contract";

export type EditorNodeState = Omit<
  NodeStateResponse,
  "version" | "createdAt" | "updatedAt"
> & {
  version: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EffectiveNodeOverrides = Pick<
  EditorNodeState,
  "name" | "description" | "properties"
>;

export function findNodeState(
  scopeId: string,
  nodeId: string,
  nodeStates: readonly EditorNodeState[],
): EditorNodeState | null {
  return (
    nodeStates.find(
      (state) => state.scopeId === scopeId && state.nodeId === nodeId,
    ) ?? null
  );
}

export function resolveEffectiveNode(
  canonical: GraphNodeResponse,
  state: EditorNodeState | null | undefined,
): GraphNodeResponse {
  if (!state) return canonical;

  return {
    ...canonical,
    name: state.name !== null ? state.name : canonical.name,
    description:
      state.description !== null ? state.description : canonical.description,
    properties:
      state.properties !== null ? state.properties : canonical.properties,
  };
}

export function normalizeNodeStateOverrides(
  canonical: GraphNodeResponse,
  effective: Pick<GraphNodeResponse, "name" | "description" | "properties">,
): EffectiveNodeOverrides {
  return {
    name: effective.name === canonical.name ? null : effective.name,
    description:
      effective.description === canonical.description
        ? null
        : effective.description,
    properties: jsonValuesEqual(effective.properties, canonical.properties)
      ? null
      : effective.properties,
  };
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => jsonValuesEqual(value, right[index]));
  }

  if (isJsonRecord(left) || isJsonRecord(right)) {
    if (!isJsonRecord(left) || !isJsonRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && jsonValuesEqual(left[key], right[key]),
    );
  }

  return false;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
