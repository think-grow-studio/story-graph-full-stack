import { betterAuth } from "better-auth";

import { authEmailAndPassword, createAuthPlugins } from "./auth-options";

export const auth = betterAuth({
  appName: "Story Graph",
  emailAndPassword: authEmailAndPassword,
  plugins: createAuthPlugins(),
});
