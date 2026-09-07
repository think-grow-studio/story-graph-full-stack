"use client";

import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  type OnConnect,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import type {
  EdgeDirection,
  EdgePresentation,
  EdgeRouting,
} from "@/contracts/graph/graph.contract";
import { projectEdgeRoute } from "@/frontend/features/graph-editor/model/edge-route-projection";
import { projectGraphFocus } from "@/frontend/features/graph-editor/model/focus-projection";
import { buildRelationshipBundles } from "@/frontend/features/graph-editor/model/relationship-bundle";
import {
  StoryGraphEdge,
  type RelationshipVisualState,
  type StoryGraphFlowEdge,
} from "./story-graph-edge";
import {
  StoryGraphNode,
  type StoryGraphFlowNode,
} from "./story-graph-node";

export type GraphCanvasNode = {
  id: string;
  name: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
};

export type GraphCanvasEdge = {
  id: string;
  name: string;
  sourceNodeId: string;
  targetNodeId: string;
  direction: EdgeDirection;
  presentation: EdgePresentation;
  routing: EdgeRouting;
};

export type GraphCanvasHandle = {
  getCenterPosition: () => { x: number; y: number };
};

export type GraphCanvasProps = {
  nodes: GraphCanvasNode[];
  edges?: GraphCanvasEdge[];
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
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

const nodeTypes = { storyGraph: StoryGraphNode };
const edgeTypes = { storyGraph: StoryGraphEdge };
const defaultNodeWidth = 112;
const defaultNodeHeight = 48;

type FlowNode = StoryGraphFlowNode;
type FlowEdge = StoryGraphFlowEdge;

export function GraphCanvas({
  nodes,
  edges = [],
  selectedNodeId = null,
  selectedEdgeId = null,
  onNodePositionChange,
  onNodeDragStart,
  onNodeDragStop,
  onConnectNodes,
  onSelectNode,
  onSelectEdge,
  ref,
}: GraphCanvasProps) {
  const [connectionActive, setConnectionActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);
  const focus = useMemo(
    () => projectGraphFocus({ selectedNodeId, selectedEdgeId, edges }),
    [edges, selectedEdgeId, selectedNodeId],
  );
  const hasFocus = selectedNodeId !== null || selectedEdgeId !== null;
  const flowNodes = useMemo<FlowNode[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: "storyGraph",
        position: node.position,
        selected: node.id === selectedNodeId,
        style:
          hasFocus && !focus.focusedNodeIds.has(node.id)
            ? { opacity: 0.25 }
            : undefined,
        data: { label: node.name, connectionActive },
      })),
    [connectionActive, focus.focusedNodeIds, hasFocus, nodes, selectedNodeId],
  );
  const flowEdges = useMemo<FlowEdge[]>(() => {
    const boundsById = new Map(
      nodes.map((node) => [
        node.id,
        {
          x: node.position.x,
          y: node.position.y,
          width: node.width ?? defaultNodeWidth,
          height: node.height ?? defaultNodeHeight,
        },
      ]),
    );

    return buildRelationshipBundles(edges).flatMap((bundle) =>
      bundle.edges.map((edge, laneIndex) => {
        const sourceNode = boundsById.get(edge.sourceNodeId);
        const targetNode = boundsById.get(edge.targetNodeId);
        const route = projectEdgeRoute({
          edge,
          sourceNode: sourceNode ?? {
            x: 0,
            y: 0,
            width: defaultNodeWidth,
            height: defaultNodeHeight,
          },
          targetNode: targetNode ?? {
            x: 0,
            y: 0,
            width: defaultNodeWidth,
            height: defaultNodeHeight,
          },
          laneIndex,
          laneCount: bundle.edges.length,
        });

        return {
          id: edge.id,
          type: "storyGraph",
          source: edge.sourceNodeId,
          target: edge.targetNodeId,
          sourceHandle: route.sourcePort,
          targetHandle: route.targetPort,
          data: {
            label: edge.name,
            direction: route.direction,
            routingType: route.routingType,
            sourcePort: route.sourcePort,
            targetPort: route.targetPort,
            waypoints: route.waypoints,
            laneIndex: route.laneIndex,
            laneCount: route.laneCount,
            visualState: getRelationshipVisualState(
              edge.id,
              hasFocus,
              focus.focusedEdgeIds,
              focus.secondaryEdgeIds,
            ),
            presentation: edge.presentation,
          },
        } satisfies FlowEdge;
      }),
    );
  }, [edges, focus.focusedEdgeIds, focus.secondaryEdgeIds, hasFocus, nodes]);

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
    setConnectionActive(false);
    if (!connection.source || !connection.target) return;
    onConnectNodes(connection.source, connection.target);
  };

  return (
    <div
      aria-label="Graph canvas"
      className="h-full min-h-[420px] overflow-hidden rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] shadow-[0_1px_2px_rgba(23,25,29,0.03)]"
      ref={containerRef}
    >
      <ReactFlow<FlowNode, FlowEdge>
        connectionMode={ConnectionMode.Loose}
        edges={flowEdges}
        edgeTypes={edgeTypes}
        fitView
        nodes={flowNodes}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onConnectEnd={() => setConnectionActive(false)}
        onConnectStart={() => setConnectionActive(true)}
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

function getRelationshipVisualState(
  edgeId: string,
  hasFocus: boolean,
  focusedEdgeIds: Set<string>,
  secondaryEdgeIds: Set<string>,
): RelationshipVisualState {
  if (!hasFocus) return "idle";
  if (focusedEdgeIds.has(edgeId)) return "selected";
  if (secondaryEdgeIds.has(edgeId)) return "secondary";
  return "dimmed";
}
