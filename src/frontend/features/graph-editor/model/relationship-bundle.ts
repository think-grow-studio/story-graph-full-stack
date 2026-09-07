import type { EdgeDirection } from "@/contracts/graph/graph.contract";

export type BundleEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  direction: EdgeDirection;
};

export type RelationshipBundle<T extends BundleEdge = BundleEdge> = {
  key: string;
  nodeIds: readonly [string, string];
  edges: T[];
};

export function buildRelationshipBundles<T extends BundleEdge>(
  edges: readonly T[],
): RelationshipBundle<T>[] {
  const grouped = new Map<string, RelationshipBundle<T>>();

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
  left: BundleEdge,
  right: BundleEdge,
  [lowerId]: readonly [string, string],
) {
  const rankDifference = edgeRank(left, lowerId) - edgeRank(right, lowerId);
  return rankDifference !== 0 ? rankDifference : left.id.localeCompare(right.id);
}

function edgeRank(edge: BundleEdge, lowerId: string) {
  if (edge.direction === "UNDIRECTED") return 0;
  return edge.sourceNodeId === lowerId ? 1 : 2;
}
