export type ResolvedPort = "top" | "right" | "bottom" | "left";
export type PersistedPort = ResolvedPort | "auto";

export type NodeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function resolvePort(from: NodeBounds, to: NodeBounds): ResolvedPort {
  const fromCenter = center(from);
  const toCenter = center(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

export function resolveConnectionPorts({
  source,
  target,
  sourcePort,
  targetPort,
}: {
  source: NodeBounds;
  target: NodeBounds;
  sourcePort: PersistedPort;
  targetPort: PersistedPort;
}) {
  return {
    sourcePort: sourcePort === "auto" ? resolvePort(source, target) : sourcePort,
    targetPort: targetPort === "auto" ? resolvePort(target, source) : targetPort,
  };
}

function center(bounds: NodeBounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}
