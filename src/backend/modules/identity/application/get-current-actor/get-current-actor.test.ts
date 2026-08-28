import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSessionService } from "../../domain/auth-session.service";
import {
  getCurrentActor,
  requireCurrentActor,
} from "./get-current-actor";

function createSessionService() {
  return {
    getCurrentActor: vi.fn<AuthSessionService["getCurrentActor"]>(),
  };
}

describe("getCurrentActor", () => {
  let session: ReturnType<typeof createSessionService>;

  beforeEach(() => {
    session = createSessionService();
  });

  it("returns null when there is no authenticated actor", async () => {
    const headers = new Headers();
    session.getCurrentActor.mockResolvedValue(null);

    await expect(getCurrentActor(headers, { session })).resolves.toBeNull();
    expect(session.getCurrentActor).toHaveBeenCalledWith(headers);
  });

  it("returns the actor supplied by the auth session port", async () => {
    const headers = new Headers({ cookie: "session=example" });
    session.getCurrentActor.mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
    });

    await expect(getCurrentActor(headers, { session })).resolves.toEqual({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
    });
  });
});

describe("requireCurrentActor", () => {
  let session: ReturnType<typeof createSessionService>;

  beforeEach(() => {
    session = createSessionService();
  });

  it("throws UNAUTHORIZED when the request has no session", async () => {
    session.getCurrentActor.mockResolvedValue(null);

    await expect(
      requireCurrentActor(new Headers(), { session }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });
});
