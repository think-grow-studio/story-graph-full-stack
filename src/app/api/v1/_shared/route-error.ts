import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApplicationError } from "@/backend/common/errors/application-error";

export function routeErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApplicationError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.status },
    );
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid request" },
      { status: 400 },
    );
  }

  throw error;
}
