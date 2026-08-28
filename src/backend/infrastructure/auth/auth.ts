import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { serverEnv } from "@/config/env.server";
import { db } from "@/backend/infrastructure/database/client";
import * as schema from "@/backend/infrastructure/database/schema";

export const auth = betterAuth({
  appName: "Story Graph",
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [organization()],
});
