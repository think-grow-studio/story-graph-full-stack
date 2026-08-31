"use client";

import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type OnConnect,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from "react";

export type GraphCanvasNode = {
  id: string;
  name: string;
  position: { x: number; y: number };
};

export type GraphCanvasEdge = {
  id: string;
  name: string;
  sourceNodeId: string;
  targetNodeId: string;
};

export type GraphCanvasHandle = {
  getCenterPosition: () => { x: number; y: number };
};

export type GraphCanvasProps = {
  nodes: GraphCanvasNode[];
  edges?: GraphCanvasEdge[];
  onNodePositionChange: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  onNodeDragStart?: (nodeId: string) => void;
  onNodeDragStop: (nodeId: string) => void;
  onConnectNodes: (sourceNodeId: string, targetNodeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
  onSelectEdge?: (edgeId: string) => void;
  ref?: Ref<GraphCanvasHandle>;
};

type FlowNode = Node<{ label: string }>;

export function GraphCanvas({
  nodes,
  edges = [],
  onNodePositionChange,
  onNodeDragStart,
  onNodeDragStop,
  onConnectNodes,
  onSelectNode,
  onSelectEdge,
  ref,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null);
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
        label: edge.name,
      })),
    [edges],
  );

  useImperativeHandle(ref, () => ({
    getCenterPosition() {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) {
        return { x: 0, y: 0 };
      }

      const screenCenter = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      };
      return (
        instanceRef.current?.screenToFlowPosition(screenCenter) ?? {
          x: bounds.width / 2,
          y: bounds.height / 2,
        }
      );
    },
  }));

  const handleNodeDragStart: OnNodeDrag<FlowNode> = (_, node) => {
    onNodeDragStart?.(node.id);
  };

  const handleNodeDrag: OnNodeDrag<FlowNode> = (_, node) => {
    onNodePositionChange(node.id, node.position);
  };

  const handleNodeDragStop: OnNodeDrag<FlowNode> = (_, node) => {
    onNodePositionChange(node.id, node.position);
    onNodeDragStop(node.id);
  };

  const handleConnect: OnConnect = (connection) => {
    if (!connection.source || !connection.target) return;
    onConnectNodes(connection.source, connection.target);
  };

  return (
    <div
      aria-label="Graph canvas"
      className="h-full min-h-[420px] overflow-hidden rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] shadow-[0_1px_2px_rgba(23,25,29,0.03)]"
      ref={containerRef}
    >
      <ReactFlow<FlowNode, Edge>
        edges={flowEdges}
        fitView
        nodes={flowNodes}
        onConnect={handleConnect}
        onEdgeClick={(_, edge) => onSelectEdge?.(edge.id)}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        onNodeClick={(_, node) => onSelectNode?.(node.id)}
        onNodeDrag={handleNodeDrag}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
