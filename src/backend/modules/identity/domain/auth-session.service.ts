import type { Actor } from "./actor";

export interface AuthSessionService {
  getCurrentActor(requestHeaders: Headers): Promise<Actor | null>;
}
