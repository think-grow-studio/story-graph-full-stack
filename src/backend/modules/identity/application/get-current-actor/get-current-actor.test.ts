import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/backend/infrastructure/auth/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

import {
  getCurrentActor,
  requireCurrentActor,
} from "./get-current-actor";

describe("getCurrentActor", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("returns null when there is no Better Auth session", async () => {
    const headers = new Headers();
    getSession.mockResolvedValue(null);

    await expect(getCurrentActor(headers)).resolves.toBeNull();
    expect(getSession).toHaveBeenCalledWith({ headers });
  });

  it("maps the Better Auth user to the identity Actor", async () => {
    const headers = new Headers({ cookie: "session=example" });
    getSession.mockResolvedValue({
      session: { id: "session-1" },
      user: {
        id: "user-1",
        email: "ada@example.com",
        name: "Ada",
        image: null,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await expect(getCurrentActor(headers)).resolves.toEqual({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
    });
  });
});

describe("requireCurrentActor", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("throws UNAUTHORIZED when the request has no session", async () => {
    getSession.mockResolvedValue(null);

    await expect(requireCurrentActor(new Headers())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });
});
