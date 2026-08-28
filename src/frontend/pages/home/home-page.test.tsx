import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./home-page";

describe("HomePage", () => {
  it("identifies Story Graph", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Story Graph" })).toBeInTheDocument();
  });
});
