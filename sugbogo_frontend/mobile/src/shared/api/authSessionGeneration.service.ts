let authSessionGeneration = 0;
let hasActiveAuthSession = false;

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
export function beginAuthSession() {
  authSessionGeneration += 1;
  hasActiveAuthSession = true;
  return authSessionGeneration;
}

/** Invalidates all asynchronous work associated with the previous session. */
export function invalidateAuthSession() {
  authSessionGeneration += 1;
  hasActiveAuthSession = false;
  return authSessionGeneration;
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
