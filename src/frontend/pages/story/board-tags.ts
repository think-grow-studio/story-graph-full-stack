export class BoardTagsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardTagsValidationError";
  }
}

export function parseBoardTags(value: string): string[] {
  const tags = value
    .split(",")
    .map((tag) => tag.trim().replace(/^#+/, "").trim())
    .filter(Boolean);

  if (new Set(tags).size !== tags.length) {
    throw new BoardTagsValidationError("같은 태그를 두 번 붙일 수 없습니다.");
  }
  if (tags.some((tag) => tag.length > 50)) {
    throw new BoardTagsValidationError("태그는 50자 이하로 입력해 주세요.");
  }
  return tags;
}

export function formatBoardTags(tags: string[]): string {
  return tags.join(", ");
}
