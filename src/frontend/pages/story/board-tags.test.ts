import { describe, expect, it } from "vitest";

import { BoardTagsValidationError, formatBoardTags, parseBoardTags } from "./board-tags";

describe("board tags", () => {
  it("normalizes comma-separated tags and strips an optional # prefix", () => {
    expect(parseBoardTags("#인물, 전체")).toEqual(["인물", "전체"]);
  });

  it("ignores blank segments", () => {
    expect(parseBoardTags("인물, , #전체,   ")).toEqual(["인물", "전체"]);
  });

  it("rejects duplicate normalized tags", () => {
    expect(() => parseBoardTags("인물, #인물")).toThrow(
      new BoardTagsValidationError("같은 태그를 두 번 붙일 수 없습니다."),
    );
  });

  it("rejects tags longer than 50 characters", () => {
    expect(() => parseBoardTags("가".repeat(51))).toThrow(
      new BoardTagsValidationError("태그는 50자 이하로 입력해 주세요."),
    );
  });

  it("formats tags for the edit field", () => {
    expect(formatBoardTags(["인물", "전체"])).toBe("인물, 전체");
  });
});
