import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { auth } from "@/backend/infrastructure/auth/auth";
import { db } from "@/backend/infrastructure/database/client";
import { session, user } from "@/backend/infrastructure/database/schema";

describe("Better Auth PostgreSQL integration", () => {
  it("persists a session that can be resolved from the returned cookie", async () => {
    const email = `auth-${crypto.randomUUID()}@example.com`;
    const result = await auth.api.signUpEmail({
      returnHeaders: true,
      body: {
        email,
        password: "Password123!",
        name: "Auth Test",
      },
    });

    try {
      const sessions = await db
        .select()
        .from(session)
        .where(eq(session.userId, result.response.user.id));

      expect(sessions).toHaveLength(1);

      const cookie = result.headers
        .getSetCookie()
        .map((value) => value.split(";", 1)[0])
        .join("; ");

      const resolved = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });

      expect(resolved?.user.email).toBe(email);
    } finally {
      await db.delete(user).where(eq(user.id, result.response.user.id));
    }
  });
});
