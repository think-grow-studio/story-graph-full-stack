import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { auth } from "@/backend/infrastructure/auth/auth";
import { db } from "@/backend/infrastructure/database/client";
import { session } from "@/backend/infrastructure/database/schema";
import { createTestIdentity } from "../../helpers/test-auth";

describe("Better Auth PostgreSQL integration", () => {
  it("persists a session that production auth resolves from the test cookie", async () => {
    const identity = await createTestIdentity("Auth Test");

    try {
      const sessions = await db
        .select()
        .from(session)
        .where(eq(session.userId, identity.user.id));

      expect(sessions).toHaveLength(1);

      const resolved = await auth.api.getSession({ headers: identity.headers });
      expect(resolved?.user.id).toBe(identity.user.id);
      expect(resolved?.user.email).toBe(identity.user.email);
    } finally {
      await identity.helpers.deleteUser(identity.user.id);
    }
  });
});
