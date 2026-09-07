import type {
  EdgeDirection,
  EdgeRouting,
} from "@/contracts/graph/graph.contract";
import {
  resolveConnectionPorts,
  type NodeBounds,
  type ResolvedPort,
} from "./port-resolver";

export type RoutableEdge = {
  direction: EdgeDirection;
  routing: EdgeRouting;
};

export type EdgeRouteProjection = {
  routingType: EdgeRouting["type"];
  sourcePort: ResolvedPort;
  targetPort: ResolvedPort;
  waypoints: EdgeRouting["waypoints"];
  laneIndex: number;
  laneCount: number;
  direction: EdgeDirection;
};

export function projectEdgeRoute<T extends RoutableEdge>({
  edge,
  sourceNode,
  targetNode,
  laneIndex,
  laneCount,
}: {
  edge: T;
  sourceNode: NodeBounds;
  targetNode: NodeBounds;
  laneIndex: number;
  laneCount: number;
}): EdgeRouteProjection {
  const ports = resolveConnectionPorts({
    source: sourceNode,
    target: targetNode,
    sourcePort: edge.routing.sourcePort,
    targetPort: edge.routing.targetPort,
  });

  return {
    routingType: edge.routing.type,
    sourcePort: ports.sourcePort,
    targetPort: ports.targetPort,
    waypoints: edge.routing.waypoints.map((point) => ({ ...point })),
    laneIndex,
    laneCount,
    direction: edge.direction,
  };
}
