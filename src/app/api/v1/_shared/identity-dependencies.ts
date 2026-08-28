import { BetterAuthSessionService } from "@/backend/modules/identity/infrastructure/better-auth-session.service";

export const identityDependencies = {
  session: new BetterAuthSessionService(),
};
