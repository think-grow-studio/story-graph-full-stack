import { organization } from "better-auth/plugins";

export const authEmailAndPassword = {
  enabled: false,
} as const;

export function createSocialProviders(input: {
  clientId: string;
  clientSecret: string;
}) {
  return {
    google: {
      clientId: input.clientId,
      clientSecret: input.clientSecret,
    },
  } as const;
}

export function createAuthPlugins() {
  return [organization()];
}
