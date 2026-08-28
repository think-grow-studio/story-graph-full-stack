import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, testUtils } from "better-auth/plugins";

import { db } from "@/backend/infrastructure/database/client";
import * as schema from "@/backend/infrastructure/database/schema";
import { serverEnv } from "@/config/env.server";

export const testAuth = betterAuth({
  appName: "Story Graph",
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [organization(), testUtils()],
});

export async function createTestIdentity(name: string) {
  const helpers = (await testAuth.$context).test;
  const user = helpers.createUser({
    name,
    email: `test-${crypto.randomUUID()}@example.com`,
    emailVerified: true,
  });
  await helpers.saveUser(user);
  const headers = await helpers.getAuthHeaders({ userId: user.id });

  return {
    helpers,
    user,
    headers,
    cookie: headers.get("cookie") ?? "",
  };
}
