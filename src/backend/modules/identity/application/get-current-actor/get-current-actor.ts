import { ApplicationError } from "@/backend/common/errors/application-error";
import type { Actor } from "../../domain/actor";
import type { AuthSessionService } from "../../domain/auth-session.service";

type Dependencies = {
  session: AuthSessionService;
};

export async function getCurrentActor(
  requestHeaders: Headers,
  dependencies: Dependencies,
): Promise<Actor | null> {
  return dependencies.session.getCurrentActor(requestHeaders);
}

export async function requireCurrentActor(
  requestHeaders: Headers,
  dependencies: Dependencies,
): Promise<Actor> {
  const actor = await getCurrentActor(requestHeaders, dependencies);
  if (!actor) {
    throw new ApplicationError("UNAUTHORIZED", 401);
  }

  return actor;
}
