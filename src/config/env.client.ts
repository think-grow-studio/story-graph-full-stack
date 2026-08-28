import { parseClientEnv } from "./env.schema";

export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
