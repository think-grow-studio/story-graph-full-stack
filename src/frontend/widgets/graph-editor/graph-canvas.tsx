"use client";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react";
import { useMemo } from "react";

export type GraphCanvasNode = {
  id: string;
  name: string;
  position: { x: number; y: number };
};

export type GraphCanvasEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

type FlowNode = Node<{ label: string }>;

export function GraphCanvas({
  nodes,
  edges = [],
  onNodePositionChange,
  onNodeDragStop,
}: {
  nodes: GraphCanvasNode[];
  edges?: GraphCanvasEdge[];
  onNodePositionChange: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  onNodeDragStop: (nodeId: string) => void;
}) {
  const flowNodes = useMemo<FlowNode[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        position: node.position,
        data: { label: node.name },
      })),
    [nodes],
  );
  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
      })),
    [edges],
  );

  const handleNodeDrag: OnNodeDrag<FlowNode> = (_, node) => {
    onNodePositionChange(node.id, node.position);
  };

  const handleNodeDragStop: OnNodeDrag<FlowNode> = (_, node) => {
    onNodePositionChange(node.id, node.position);
    onNodeDragStop(node.id);
  };

  return (
    <div
      aria-label="Graph canvas"
      className="h-[560px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
    >
      <ReactFlow<FlowNode, Edge>
        edges={flowEdges}
        fitView
        nodes={flowNodes}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
