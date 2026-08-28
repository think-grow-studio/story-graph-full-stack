"use client";

import { useState, type PointerEvent } from "react";

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
  const [drag, setDrag] = useState<{
    nodeId: string;
    pointerX: number;
    pointerY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    node: GraphCanvasNode,
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      nodeId: node.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    onNodePositionChange(drag.nodeId, {
      x: drag.nodeX + event.clientX - drag.pointerX,
      y: drag.nodeY + event.clientY - drag.pointerY,
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const nodeId = drag.nodeId;
    setDrag(null);
    onNodeDragStop(nodeId);
  }

  return (
    <div
      aria-label="Graph canvas"
      className="relative min-h-[560px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {edges.map((edge) => {
          const source = nodeById.get(edge.sourceNodeId);
          const target = nodeById.get(edge.targetNodeId);
          if (!source || !target) return null;
          return (
            <line
              key={edge.id}
              stroke="currentColor"
              strokeOpacity="0.25"
              x1={source.position.x + 70}
              x2={target.position.x + 70}
              y1={source.position.y + 24}
              y2={target.position.y + 24}
            />
          );
        })}
      </svg>

      {nodes.map((node) => (
        <button
          aria-label={`Node ${node.name}`}
          className="absolute min-w-36 cursor-grab touch-none rounded-lg border border-neutral-300 bg-white px-4 py-3 text-left shadow-sm active:cursor-grabbing"
          data-node-id={node.id}
          key={node.id}
          onPointerDown={(event) => handlePointerDown(event, node)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            transform: `translate(${node.position.x}px, ${node.position.y}px)`,
          }}
          type="button"
        >
          {node.name}
        </button>
      ))}
    </div>
  );
}
