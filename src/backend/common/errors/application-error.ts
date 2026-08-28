export type ApplicationErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR";

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    public readonly status: number,
    message: string = code,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
