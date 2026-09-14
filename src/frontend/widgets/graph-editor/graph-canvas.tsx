"use client";

import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  type OnConnect,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
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
  onClearSelection?: () => void;
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
const relationshipInteractionWidth = 48;
const railHoverCloseDelayMs = 120;

type FlowNode = StoryGraphFlowNode;
type FlowEdge = StoryGraphFlowEdge;

export function GraphCanvas({
  nodes,
  edges = [],
  selectedNodeId = null,
  selectedEdgeId = null,
  onClearSelection,
  onNodePositionChange,
  onNodeDragStart,
  onNodeDragStop,
  onConnectNodes,
  onSelectNode,
  onSelectEdge,
  ref,
}: GraphCanvasProps) {
  const [connectionActive, setConnectionActive] = useState(false);
  const [hoveredRailId, setHoveredRailId] = useState<string | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null);

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current === null) return;
    clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearHoverCloseTimer();
    },
    [clearHoverCloseTimer],
  );

  const requestOpenRail = useCallback(
    (railId: string) => {
      clearHoverCloseTimer();
      setHoveredRailId(railId);
    },
    [clearHoverCloseTimer],
  );

  const requestCloseRail = useCallback(
    (railId: string) => {
      clearHoverCloseTimer();
      hoverCloseTimerRef.current = setTimeout(() => {
        setHoveredRailId((current) => (current === railId ? null : current));
        hoverCloseTimerRef.current = null;
      }, railHoverCloseDelayMs);
    },
    [clearHoverCloseTimer],
  );

  const dismissRail = useCallback(
    (railId?: string) => {
      clearHoverCloseTimer();
      setHoveredRailId((current) =>
        !railId || current === railId ? null : current,
      );
    },
    [clearHoverCloseTimer],
  );

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
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
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

    return buildRelationshipBundles(edges).map((bundle) => {
      const [sourceNodeId, targetNodeId] = bundle.nodeIds;
      const representative = bundle.edges[0];
      const sourceNode = boundsById.get(sourceNodeId) ?? {
        x: 0,
        y: 0,
        width: defaultNodeWidth,
        height: defaultNodeHeight,
      };
      const targetNode = boundsById.get(targetNodeId) ?? {
        x: 0,
        y: 0,
        width: defaultNodeWidth,
        height: defaultNodeHeight,
      };
      const routeOwner =
        representative.sourceNodeId === sourceNodeId
          ? representative
          : {
              ...representative,
              routing: {
                ...representative.routing,
                sourcePort: representative.routing.targetPort,
                targetPort: representative.routing.sourcePort,
              },
            };
      const route = projectEdgeRoute({
        edge: routeOwner,
        sourceNode,
        targetNode,
        laneIndex: 0,
        laneCount: 1,
      });
      const hasForwardDirection = bundle.edges.some(
        (edge) =>
          edge.direction === "DIRECTED" && edge.sourceNodeId === sourceNodeId,
      );
      const hasReverseDirection = bundle.edges.some(
        (edge) =>
          edge.direction === "DIRECTED" && edge.sourceNodeId === targetNodeId,
      );
      const sourceLabel = nodeById.get(sourceNodeId)?.name ?? sourceNodeId;
      const targetLabel = nodeById.get(targetNodeId)?.name ?? targetNodeId;
      const railId = bundle.key;

      return {
        id: railId,
        type: "storyGraph",
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: route.sourcePort,
        targetHandle: route.targetPort,
        interactionWidth: relationshipInteractionWidth,
        markerStart: hasReverseDirection
          ? { type: MarkerType.ArrowClosed }
          : undefined,
        markerEnd: hasForwardDirection
          ? { type: MarkerType.ArrowClosed }
          : undefined,
        data: {
          relationships: bundle.edges.map((edge) => ({
            id: edge.id,
            label: edge.name,
            sourceLabel:
              nodeById.get(edge.sourceNodeId)?.name ?? edge.sourceNodeId,
            targetLabel:
              nodeById.get(edge.targetNodeId)?.name ?? edge.targetNodeId,
            direction: edge.direction,
            orientation:
              edge.direction === "UNDIRECTED"
                ? "undirected"
                : edge.sourceNodeId === sourceNodeId
                  ? "forward"
                  : "reverse",
          })),
          pairLabel: `${sourceLabel}와 ${targetLabel}`,
          popoverOpen: hoveredRailId === railId,
          selectedRelationshipId: selectedEdgeId,
          routingType: route.routingType,
          sourcePort: route.sourcePort,
          targetPort: route.targetPort,
          waypoints: route.waypoints,
          visualState: getRelationshipRailVisualState(
            bundle.edges.map((edge) => edge.id),
            hasFocus,
            focus.focusedEdgeIds,
            focus.secondaryEdgeIds,
          ),
          presentation: representative.presentation,
          onSelectPair: () => onSelectEdge?.(representative.id),
          onSelectRelationship: onSelectEdge,
          onRequestOpen: () => requestOpenRail(railId),
          onRequestClose: () => requestCloseRail(railId),
          onDismiss: () => dismissRail(railId),
        },
      } satisfies FlowEdge;
    });
  }, [
    dismissRail,
    edges,
    focus.focusedEdgeIds,
    focus.secondaryEdgeIds,
    hasFocus,
    hoveredRailId,
    nodes,
    onSelectEdge,
    requestCloseRail,
    requestOpenRail,
    selectedEdgeId,
  ]);

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
        onEdgeClick={(_, edge) => edge.data?.onSelectPair?.()}
        onEdgeMouseEnter={(_, edge) => edge.data?.onRequestOpen?.()}
        onEdgeMouseLeave={(_, edge) => edge.data?.onRequestClose?.()}
        onInit={(instance) => {
          instanceRef.current = instance;
        }}
        onNodeClick={(_, node) => onSelectNode?.(node.id)}
        onNodeDrag={handleNodeDrag}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => {
          dismissRail();
          onClearSelection?.();
        }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function getRelationshipRailVisualState(
  edgeIds: string[],
  hasFocus: boolean,
  focusedEdgeIds: Set<string>,
  secondaryEdgeIds: Set<string>,
): RelationshipVisualState {
  if (!hasFocus) return "idle";
  if (edgeIds.some((edgeId) => focusedEdgeIds.has(edgeId))) return "selected";
  if (edgeIds.some((edgeId) => secondaryEdgeIds.has(edgeId))) return "secondary";
  return "dimmed";
}
