import type { GraphEdgeResponse } from "@/contracts/graph/graph.contract";

export type RelationshipBundle = {
  key: string;
  nodeIds: readonly [string, string];
  edges: GraphEdgeResponse[];
};

export function buildRelationshipBundles(
  edges: readonly GraphEdgeResponse[],
): RelationshipBundle[] {
  const grouped = new Map<string, RelationshipBundle>();

  for (const edge of edges) {
    const nodeIds = orderedPair(edge.sourceNodeId, edge.targetNodeId);
    const key = `${nodeIds[0]}:${nodeIds[1]}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.edges.push(edge);
    } else {
      grouped.set(key, { key, nodeIds, edges: [edge] });
    }
  }

  return [...grouped.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((bundle) => ({
      ...bundle,
      edges: [...bundle.edges].sort((left, right) =>
        compareBundleEdges(left, right, bundle.nodeIds),
      ),
    }));
}

function orderedPair(left: string, right: string): readonly [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left];
}

function compareBundleEdges(
  left: GraphEdgeResponse,
  right: GraphEdgeResponse,
  [lowerId]: readonly [string, string],
) {
  const rankDifference = edgeRank(left, lowerId) - edgeRank(right, lowerId);
  return rankDifference !== 0 ? rankDifference : left.id.localeCompare(right.id);
}

function edgeRank(edge: GraphEdgeResponse, lowerId: string) {
  if (edge.direction === "UNDIRECTED") return 0;
  return edge.sourceNodeId === lowerId ? 1 : 2;
}
