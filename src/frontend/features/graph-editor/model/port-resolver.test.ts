import { describe, expect, it } from "vitest";

import { resolveConnectionPorts, resolvePort } from "./port-resolver";

const source = { x: 0, y: 0, width: 100, height: 80 };

describe("port resolver", () => {
  it.each([
    [{ x: 200, y: 0, width: 100, height: 80 }, "right"],
    [{ x: -200, y: 0, width: 100, height: 80 }, "left"],
    [{ x: 0, y: -200, width: 100, height: 80 }, "top"],
    [{ x: 0, y: 200, width: 100, height: 80 }, "bottom"],
  ] as const)("resolves the dominant relative direction", (target, expected) => {
    expect(resolvePort(source, target)).toBe(expected);
  });

  it("uses a deterministic horizontal tie-break", () => {
    expect(resolvePort(source, { x: 100, y: 100, width: 100, height: 80 })).toBe("right");
  });

  it("preserves explicit persisted ports and resolves only auto ports", () => {
    expect(
      resolveConnectionPorts({
        source,
        target: { x: 200, y: 0, width: 100, height: 80 },
        sourcePort: "top",
        targetPort: "auto",
      }),
    ).toEqual({ sourcePort: "top", targetPort: "left" });
  });
});
