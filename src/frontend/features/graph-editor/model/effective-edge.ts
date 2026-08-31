import type {
  EdgeStateResponse,
  GraphEdgeResponse,
} from "@/contracts/graph/graph.contract";

export type EditorEdgeState = Omit<
  EdgeStateResponse,
  "version" | "createdAt" | "updatedAt"
> & {
  version: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EffectiveEdgeOverrides = Pick<
  EditorEdgeState,
  "name" | "description" | "properties"
>;

export function resolveEffectiveEdge(
  canonical: GraphEdgeResponse,
  state: EditorEdgeState | null | undefined,
): GraphEdgeResponse {
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

export function normalizeEdgeStateOverrides(
  canonical: GraphEdgeResponse,
  effective: Pick<GraphEdgeResponse, "name" | "description" | "properties">,
): EffectiveEdgeOverrides {
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
