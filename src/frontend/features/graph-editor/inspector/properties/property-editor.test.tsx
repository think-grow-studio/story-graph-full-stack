import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GraphProperties } from "@/contracts/graph/graph.contract";
import { PropertyEditor } from "./property-editor";

afterEach(cleanup);

function ControlledPropertyEditor({
  initialValue,
  onChange,
}: {
  initialValue: GraphProperties;
  onChange: (value: GraphProperties) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <PropertyEditor
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      value={value}
    />
  );
}

describe("PropertyEditor", () => {
  it("edits scalar values without exposing raw JSON", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ControlledPropertyEditor
        initialValue={{ job: "mage" }}
        onChange={onChange}
      />,
    );

    expect(screen.queryByText("속성 JSON")).not.toBeInTheDocument();
    expect(screen.getByLabelText("job 값")).toHaveValue("mage");
    expect(screen.getByLabelText("새 속성 키").closest("form")).toHaveProperty(
      "noValidate",
      true,
    );

    await user.clear(screen.getByLabelText("job 값"));
    await user.type(screen.getByLabelText("job 값"), "wizard");

    expect(onChange).toHaveBeenLastCalledWith({ job: "wizard" });
  });

  it("adds and removes object keys with keyboard-operable controls", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <PropertyEditor onChange={onChange} value={{ job: "mage" }} />,
    );

    const newKey = screen.getByLabelText("새 속성 키");
    await user.type(newKey, "income{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ job: "mage", income: "" });

    rerender(
      <PropertyEditor
        onChange={onChange}
        value={{ job: "mage", income: "monthly 200" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "income 삭제" }));
    expect(onChange).toHaveBeenLastCalledWith({ job: "mage" });
  });

  it("creates nested objects and arrays with explicit controls", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <PropertyEditor onChange={onChange} value={{ place: "" }} />,
    );

    await user.selectOptions(screen.getByLabelText("place 유형"), "object");
    expect(onChange).toHaveBeenLastCalledWith({ place: {} });

    rerender(<PropertyEditor onChange={onChange} value={{ place: {} }} />);
    await user.type(screen.getByLabelText("place 새 속성 키"), "country");
    await user.click(
      screen.getByRole("button", { name: "place에 속성 추가" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({ place: { country: "" } });

    rerender(<PropertyEditor onChange={onChange} value={{ aliases: [] }} />);
    await user.click(screen.getByRole("button", { name: "aliases 값 추가" }));
    expect(onChange).toHaveBeenLastCalledWith({ aliases: [""] });
  });

  it("shows validation instead of dispatching duplicate or blank keys", () => {
    const onChange = vi.fn();
    render(<PropertyEditor onChange={onChange} value={{ job: "mage" }} />);

    fireEvent.change(screen.getByLabelText("새 속성 키"), {
      target: { value: "job" },
    });
    fireEvent.click(screen.getByRole("button", { name: "속성 추가" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "같은 이름의 속성이 이미 있습니다.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("surfaces contract validation for an invalid tree", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 201 }, (_, index) => [`key-${index}`, "value"]),
    ) as GraphProperties;

    render(<PropertyEditor onChange={vi.fn()} value={tooMany} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});