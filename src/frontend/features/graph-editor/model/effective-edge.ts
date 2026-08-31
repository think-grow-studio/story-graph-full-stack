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
