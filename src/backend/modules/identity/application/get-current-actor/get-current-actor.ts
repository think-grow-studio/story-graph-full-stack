import "server-only";

import { ApplicationError } from "@/backend/common/errors/application-error";
import { auth } from "@/backend/infrastructure/auth/auth";
import type { Actor } from "../../domain/actor";

export async function getCurrentActor(requestHeaders: Headers): Promise<Actor | null> {
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

export async function requireCurrentActor(requestHeaders: Headers): Promise<Actor> {
  const actor = await getCurrentActor(requestHeaders);
  if (!actor) {
    throw new ApplicationError("UNAUTHORIZED", 401);
  }

  return actor;
}
