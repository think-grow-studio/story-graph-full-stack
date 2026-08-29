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

type E2EAuthRuntime = {
  pool: Pool;
  db: ReturnType<typeof drizzle<typeof schema>>;
  auth: ReturnType<typeof betterAuth>;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for E2E auth setup`);
  }
  return value;
}

let runtime: E2EAuthRuntime | null = null;

function createE2EAuthRuntime(): E2EAuthRuntime {
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  const db = drizzle(pool, { schema });
  const auth = betterAuth({
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

  return { pool, db, auth };
}

function getE2EAuthRuntime(): E2EAuthRuntime {
  runtime ??= createE2EAuthRuntime();
  return runtime;
}

export interface E2EIdentity {
  userId: string;
  cookies: BrowserCookies;
}

export async function createE2EIdentity(name: string): Promise<E2EIdentity> {
  const { auth } = getE2EAuthRuntime();
  const helpers = (await auth.$context).test;
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
  const { auth, db } = getE2EAuthRuntime();
  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, identity.userId));

  for (const membership of memberships) {
    await db
      .delete(organization)
      .where(eq(organization.id, membership.organizationId));
  }

  const helpers = (await auth.$context).test;
  await helpers.deleteUser(identity.userId);
}

export async function closeE2EAuthDatabase() {
  const current = runtime;
  runtime = null;
  if (!current) return;
  await current.pool.end();
}
