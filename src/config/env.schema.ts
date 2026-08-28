import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().min(1).default("/api/v1"),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
});

export function parseClientEnv(input: Record<string, string | undefined>) {
  return clientSchema.parse(input);
}

export function parseServerEnv(input: Record<string, string | undefined>) {
  return serverSchema.parse(input);
}
