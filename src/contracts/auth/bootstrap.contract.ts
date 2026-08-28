import { z } from "zod";

export const bootstrapResponseSchema = z.object({
  actor: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string(),
  }),
  workspace: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
});

export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
