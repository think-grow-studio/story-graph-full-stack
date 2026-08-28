import { describe, expect, it } from "vitest";

import { authEmailAndPassword, createSocialProviders } from "./auth-options";

describe("auth options", () => {
  it("disables email/password authentication", () => {
    expect(authEmailAndPassword).toEqual({ enabled: false });
  });

  it("configures Google as the only social provider", () => {
    expect(
      createSocialProviders({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      }),
    ).toEqual({
      google: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      },
    });
  });
});
