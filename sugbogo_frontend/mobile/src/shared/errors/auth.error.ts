/**
 * Checks whether an error originated from an authentication failure.
 *
 * Use this only for authenticated API actions where the user already has
 * an active session (e.g. updating profile, submitting applications, etc.).
 *
 * Do not use this for authentication flows such as login, OAuth login,
 * email verification, forgot password, or password reset, since those
 * errors are expected user-facing responses and should be handled normally.
 *
 * Authentication failures are handled globally by the API client:
 * - clearing stored session data
 * - showing the session expired notification
 * - redirecting the user to login
 *
 * Feature hooks can use this check to avoid showing duplicate error
 * messages after the session has already been handled globally.
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.name === "AUTH_ERROR";
}
