// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { auth } from "@/backend/infrastructure/auth/auth";
import { db } from "@/backend/infrastructure/database/client";
import { session, user } from "@/backend/infrastructure/database/schema";

const createdUserIds: string[] = [];

afterEach(async () => {
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(user).where(eq(user.id, userId));
  }
});

describe("Better Auth persistence", () => {
  it("persists a database session when an email/password user signs up", async () => {
    const email = `auth-integration-${crypto.randomUUID()}@example.com`;

    const { headers, response } = await auth.api.signUpEmail({
      returnHeaders: true,
      body: {
        email,
        password: "password1234",
        name: "Auth Integration",
      },
    });

    createdUserIds.push(response.user.id);

    const persistedSessions = await db
      .select({ id: session.id, userId: session.userId })
      .from(session)
      .where(eq(session.userId, response.user.id));

    expect(headers.get("set-cookie")).toContain("session_token");
    expect(persistedSessions).toHaveLength(1);
    expect(persistedSessions[0]?.userId).toBe(response.user.id);
  });
});
