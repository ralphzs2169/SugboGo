/**
 * Identifiers for transport-level failures that never reach the backend
 * (network unavailable, request timeout, or a session that could not be
 * refreshed). These are distinct from backend-issued error codes, which
 * already arrive as part of the response body via `error_response()`.
 */
export const API_ERROR_CODE = {
  NETWORK_ERROR: "NETWORK_ERROR",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  SESSION_EXPIRED: "SESSION_EXPIRED",
};

/**
 * Default user-facing messages for each transport-level error code.
 * Mirrors the tone of the backend's own error messages.
 */
export const API_ERROR_MESSAGE = {
  [API_ERROR_CODE.NETWORK_ERROR]:
    "Unable to connect. Please check your internet connection and try again.",
  [API_ERROR_CODE.REQUEST_TIMEOUT]:
    "The request took too long to respond. Please try again.",
  [API_ERROR_CODE.SESSION_EXPIRED]:
    "Your session has expired. Please log in again.",
};
