import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/backend/infrastructure/database/client";
import * as schema from "@/backend/infrastructure/database/schema";
import { serverEnv } from "@/config/env.server";

import { authEmailAndPassword, createAuthPlugins } from "./auth-options";

export const auth = betterAuth({
  appName: "Story Graph",
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: authEmailAndPassword,
  plugins: createAuthPlugins(),
});
