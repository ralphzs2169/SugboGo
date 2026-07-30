import axios from "axios";
import { API_ERROR_CODE } from "./errorCodes";
import { API_ERROR_MESSAGE } from "./errorMessages";

/**
 * Executes an API request and returns a standardized API response.
 *
 * Successful requests return the response payload unchanged.
 * Failures are normalized into the application's standard API response
 * format, allowing callers to handle all errors consistently without
 * distinguishing between network failures, transport errors, or
 * backend responses.
 *
 * Transport-level failures (e.g. network unavailable, request timeout,
 * or expired session) are identified by API error codes attached by the
 * Axios interceptors. Backend validation and business errors are returned
 * directly from the server.
 *
 * @template T - The expected API response type.
 * @param promise - The Axios request promise.
 * @returns The standardized API response.
 */
export async function request<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    // Handle transport-level API errors created by the Axios interceptors.
    // These are converted into the application's standard API response
    // format so callers can handle them the same way as backend responses.
    if (error instanceof Error) {
      switch (error.name) {
        // The user's authenticated session has expired.
        case API_ERROR_CODE.AUTH_ERROR:
          return {
            success: false,
            message: API_ERROR_MESSAGE.AUTH_ERROR,
            code: "SESSION_EXPIRED",
          } as T;

        // Unable to reach the server.
        case API_ERROR_CODE.NETWORK_ERROR:
          return {
            success: false,
            message: API_ERROR_MESSAGE.NETWORK_ERROR,
            code: API_ERROR_CODE.NETWORK_ERROR,
          } as T;

        // The server did not respond before the configured timeout.
        case API_ERROR_CODE.REQUEST_TIMEOUT:
          return {
            success: false,
            message: API_ERROR_MESSAGE.REQUEST_TIMEOUT,
            code: API_ERROR_CODE.REQUEST_TIMEOUT,
          } as T;
      }
    }

    // Handle structured error responses returned directly by the backend.
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data;
    }

    // Fallback for any unexpected error that could not be classified.
    return {
      success: false,
      message: API_ERROR_MESSAGE.UNKNOWN_ERROR,
      code: API_ERROR_CODE.UNKNOWN_ERROR,
    } as T;
  }
}
