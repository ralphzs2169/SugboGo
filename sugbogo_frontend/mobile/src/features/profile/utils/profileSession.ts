import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";

/** Pins profile work to its initiating account and login, including same-account relogins. */
export function captureProfileSession() {
  const session = {
    ownerId: useAuthStore.getState().user?.id,
    generation: getAuthSessionGeneration(),
  };
  assertProfileSessionCurrent(session);
  return session;
}

/** Prevents obsolete responses and locally processed uploads from changing another session. */
export function assertProfileSessionCurrent(session: {
  ownerId: number | undefined;
  generation: number;
}) {
  const auth = useAuthStore.getState();
  if (
    session.ownerId === undefined ||
    !auth.isAuthenticated ||
    auth.user?.id !== session.ownerId ||
    !isAuthSessionCurrent(session.generation)
  ) {
    throw new StaleAuthSessionError();
  }
}
