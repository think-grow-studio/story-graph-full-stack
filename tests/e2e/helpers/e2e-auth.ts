import type { BrowserContext } from "@playwright/test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../../../src/backend/infrastructure/database/schema";
import {
  member,
  organization,
} from "../../../src/backend/infrastructure/database/schema";

type BrowserCookies = Parameters<BrowserContext["addCookies"]>[0];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for E2E auth setup`);
  }
  return value;
}

const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
const db = drizzle(pool, { schema });

const e2eAuth = betterAuth({
  appName: "Story Graph",
  baseURL: requireEnv("BETTER_AUTH_URL"),
  secret: requireEnv("BETTER_AUTH_SECRET"),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    },
  },
  plugins: [testUtils()],
});

export interface E2EIdentity {
  userId: string;
  cookies: BrowserCookies;
}

export async function createE2EIdentity(name: string): Promise<E2EIdentity> {
  const helpers = (await e2eAuth.$context).test;
  const user = helpers.createUser({
    name,
    email: `e2e-${crypto.randomUUID()}@example.com`,
    emailVerified: true,
  });

  await helpers.saveUser(user);
  const cookies = await helpers.getCookies({ userId: user.id, domain: "localhost" });

  return {
    userId: user.id,
    cookies: cookies as BrowserCookies,
  };
}

export async function cleanupE2EIdentity(identity: E2EIdentity) {
  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, identity.userId));

  for (const membership of memberships) {
    await db
      .delete(organization)
      .where(eq(organization.id, membership.organizationId));
  }

  const helpers = (await e2eAuth.$context).test;
  await helpers.deleteUser(identity.userId);
}

export async function closeE2EAuthDatabase() {
  await pool.end();
}
