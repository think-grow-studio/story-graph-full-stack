import { organization } from "better-auth/plugins";

export const authEmailAndPassword = {
  enabled: true,
} as const;

export function createAuthPlugins() {
  return [organization()];
}
