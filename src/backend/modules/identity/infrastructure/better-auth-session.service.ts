import "server-only";

import { auth } from "@/backend/infrastructure/auth/auth";
import type { AuthSessionService } from "../domain/auth-session.service";

export class BetterAuthSessionService implements AuthSessionService {
  async getCurrentActor(requestHeaders: Headers) {
    const currentSession = await auth.api.getSession({ headers: requestHeaders });
    if (!currentSession) {
      return null;
    }

    return {
      id: currentSession.user.id,
      email: currentSession.user.email,
      name: currentSession.user.name,
    };
  }
}
