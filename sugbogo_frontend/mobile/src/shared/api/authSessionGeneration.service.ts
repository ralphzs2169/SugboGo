let authSessionGeneration = 0;
let hasActiveAuthSession = false;
let offlineTransportSession = false;

type SessionChange = "replace" | "restore" | "revoke" | "offline";
const sessionListeners = new Set<(change: SessionChange) => void>();

/** Observes synchronous session boundaries without granting authentication. */
export function subscribeAuthSessionChanges(
  listener: (change: SessionChange) => void,
) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function notifySessionChange(change: SessionChange) {
  sessionListeners.forEach((listener) => {
    try {
      listener(change);
    } catch {
      if (__DEV__) {
        console.warn("Session observer cleanup failed.");
      }
    }
  });
}

/**
 * Error raised when asynchronous authentication work belongs to a session
 * that has since been replaced or invalidated.
 */
export class StaleAuthSessionError extends Error {
  constructor() {
    super("Authentication session is no longer current");
    this.name = "StaleAuthSessionError";
  }
}

/** Returns the identity of the currently valid local authentication session. */
export function getAuthSessionGeneration() {
  return authSessionGeneration;
}

/** Starts a new authenticated-session generation. */
export function beginAuthSession(change: "replace" | "restore" = "replace") {
  authSessionGeneration += 1;
  hasActiveAuthSession = true;
  offlineTransportSession = false;
  notifySessionChange(change);
  return authSessionGeneration;
}

/** Invalidates all asynchronous work associated with the previous session. */
export function invalidateAuthSession() {
  authSessionGeneration += 1;
  hasActiveAuthSession = false;
  offlineTransportSession = false;
  notifySessionChange("revoke");
  return authSessionGeneration;
}

/** Withdraws API authority after startup transport failure, preserving temporary disk data. */
export function suspendAuthSession() {
  authSessionGeneration += 1;
  hasActiveAuthSession = false;
  offlineTransportSession = true;
  notifySessionChange("offline");
  return authSessionGeneration;
}

/** Eligibility probes are allowed only after the current startup transport failure. */
export function isOfflineTransportSession(generation: number) {
  return offlineTransportSession && isAuthSessionGenerationCurrent(generation);
}

/** Checks whether asynchronous work still belongs to the active session. */
export function isAuthSessionCurrent(generation: number) {
  return hasActiveAuthSession && isAuthSessionGenerationCurrent(generation);
}

/** Checks generation identity for serialized cleanup after invalidation. */
export function isAuthSessionGenerationCurrent(generation: number) {
  return generation === authSessionGeneration;
}

/** Throws when asynchronous authentication work has become obsolete. */
export function assertAuthSessionCurrent(generation: number) {
  if (!isAuthSessionCurrent(generation)) {
    throw new StaleAuthSessionError();
  }
}

export function isStaleAuthSessionError(
  error: unknown,
): error is StaleAuthSessionError {
  return error instanceof StaleAuthSessionError;
}
