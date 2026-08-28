import "server-only";

import { parseServerEnv } from "./env.schema";

export const serverEnv = parseServerEnv({
  NODE_ENV: process.env.NODE_ENV,
});
