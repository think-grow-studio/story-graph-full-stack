import { z } from "zod";

export const apiErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
