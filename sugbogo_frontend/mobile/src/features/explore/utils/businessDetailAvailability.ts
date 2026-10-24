/** These are the actual DRF exception codes exposed by the detail endpoint. */
export function isBusinessDetailDenied(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return (
    error.code === "NOT_FOUND" ||
    error.code === "PERMISSION_DENIED" ||
    error.code === "NOT_AUTHENTICATED" ||
    error.code === "AUTHENTICATION_FAILED" ||
    error.code === "SESSION_EXPIRED"
  );
}

/** Only ambiguous transport/server failures may use local presentation. */
export function canUseBusinessDetailFallback(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return (
    error.code === "NETWORK_ERROR" ||
    error.code === "REQUEST_TIMEOUT" ||
    error.code === "UNKNOWN_ERROR"
  );
}
