import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders a semantic button with the requested label", () => {
    render(<Button>저장</Button>);

    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("keeps its accessible label and disables interaction while busy", () => {
    render(<Button busy>저장</Button>);

    const button = screen.getByRole("button", { name: "저장" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
