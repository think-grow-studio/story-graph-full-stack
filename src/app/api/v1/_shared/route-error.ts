import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApplicationError } from "@/backend/common/errors/application-error";
import { apiErrorResponseSchema } from "@/contracts/common/error.contract";

function apiError(code: string, message: string) {
  return apiErrorResponseSchema.parse({ code, message });
}

export function routeErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApplicationError) {
    return NextResponse.json(apiError(error.code, error.message), {
      status: error.status,
    });
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json(apiError("VALIDATION_ERROR", "Invalid request"), {
      status: 400,
    });
  }

  throw error;
}
