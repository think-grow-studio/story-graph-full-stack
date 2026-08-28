import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { auth } from "@/backend/infrastructure/auth/auth";
import { db, pool } from "@/backend/infrastructure/database/client";
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

  afterAll(async () => {
    await pool.end();
  });
});
