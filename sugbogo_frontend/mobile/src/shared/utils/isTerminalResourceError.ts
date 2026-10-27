/** Cached content is unsafe after an authoritative identity or access failure. */
export default function isTerminalResourceError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return [
    "NOT_FOUND",
    "PERMISSION_DENIED",
    "NOT_AUTHENTICATED",
    "AUTHENTICATION_FAILED",
    "AUTHENTICATION_REQUIRED",
    "SESSION_EXPIRED",
  ].includes(String(error.code));
}
