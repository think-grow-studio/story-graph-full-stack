import type { GraphEdgeResponse } from "@/contracts/graph/graph.contract";

export type FocusProjection = {
  focusedNodeIds: Set<string>;
  focusedEdgeIds: Set<string>;
  secondaryEdgeIds: Set<string>;
};

export function projectGraphFocus({
  selectedNodeId,
  selectedEdgeId,
  edges,
}: {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  edges: readonly GraphEdgeResponse[];
}): FocusProjection {
  const focusedNodeIds = new Set<string>();
  const focusedEdgeIds = new Set<string>();
  const secondaryEdgeIds = new Set<string>();

  if (selectedNodeId) {
    focusedNodeIds.add(selectedNodeId);
    for (const edge of edges) {
      if (
        edge.sourceNodeId !== selectedNodeId &&
        edge.targetNodeId !== selectedNodeId
      ) {
        continue;
      }
      focusedEdgeIds.add(edge.id);
      focusedNodeIds.add(edge.sourceNodeId);
      focusedNodeIds.add(edge.targetNodeId);
    }
    return { focusedNodeIds, focusedEdgeIds, secondaryEdgeIds };
  }

  if (selectedEdgeId) {
    const selected = edges.find((edge) => edge.id === selectedEdgeId);
    if (!selected) return { focusedNodeIds, focusedEdgeIds, secondaryEdgeIds };

    focusedEdgeIds.add(selected.id);
    focusedNodeIds.add(selected.sourceNodeId);
    focusedNodeIds.add(selected.targetNodeId);

    const selectedPair = unorderedPairKey(
      selected.sourceNodeId,
      selected.targetNodeId,
    );
    for (const edge of edges) {
      if (
        edge.id !== selected.id &&
        unorderedPairKey(edge.sourceNodeId, edge.targetNodeId) === selectedPair
      ) {
        secondaryEdgeIds.add(edge.id);
      }
    }
  }

  return { focusedNodeIds, focusedEdgeIds, secondaryEdgeIds };
}

function unorderedPairKey(left: string, right: string) {
  return left.localeCompare(right) <= 0
    ? `${left}:${right}`
    : `${right}:${left}`;
}
