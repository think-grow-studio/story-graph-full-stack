import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomePage } from "./home-page";

afterEach(cleanup);

describe("HomePage", () => {
  it("makes the product purpose and entry actions obvious", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "이야기는 연결될 때 선명해집니다." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "시작하기" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });
});
