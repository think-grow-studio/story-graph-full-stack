"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";

export type StoryGraphNodeData = {
  label: string;
  connectionActive?: boolean;
};

export type StoryGraphFlowNode = Node<StoryGraphNodeData, "storyGraph">;

const ports = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

export function StoryGraphNode({ data, selected }: NodeProps<StoryGraphFlowNode>) {
  const revealPorts = selected || data.connectionActive;

  return (
    <div
      className="group relative min-w-28 rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] px-4 py-2 shadow-[0_1px_2px_rgba(23,25,29,0.06)] outline-none focus-within:border-[var(--sg-accent)] focus-within:ring-2 focus-within:ring-[color:var(--sg-accent-soft)]"
      tabIndex={0}
    >
      <div className="text-sm font-medium text-[var(--sg-text)]">{data.label}</div>
      {ports.map((port) => (
        <Handle
          className={`!h-6 !w-6 !border-0 !bg-transparent after:absolute after:left-1/2 after:top-1/2 after:h-2 after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-[var(--sg-accent)] after:bg-[var(--sg-surface)] after:transition-opacity ${
            revealPorts
              ? "after:opacity-100"
              : "after:opacity-20 group-hover:after:opacity-100 group-focus-within:after:opacity-100"
          }`}
          id={port.id}
          key={port.id}
          position={port.position}
          type="source"
        />
      ))}
    </div>
  );
}
