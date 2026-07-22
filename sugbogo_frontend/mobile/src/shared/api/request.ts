// api/request.ts

import axios from "axios";

/**
 * Handles API requests and normalizes Axios errors into the application's
 * standardized API response format.
 *
 * Since the backend already returns structured error responses such as:
 *
 * {
 *   "success": false,
 *   "message": "Invalid credentials.",
 *   "code": "INVALID_CREDENTIALS"
 * }
 *
 * this helper prevents every service function from needing its own
 * try/catch block for Axios errors.
 *
 * @template T - The expected API response type.
 *
 * @param {Promise<{ data: T }>} promise - The Axios request promise.
 *
 * @returns {Promise<T>}
 * Returns the backend response data on success or the standardized error
 * response returned by the backend.
 *
 */
export async function request<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        return {
          success: false,
          message: "The server took too long to respond. Please try again.",
          code: "REQUEST_TIMEOUT",
        } as T;
      }

      if (!error.response) {
        return {
          success: false,
          message:
            "Unable to connect to the server. Check your internet connection.",
          code: "NETWORK_ERROR",
        } as T;
      }

      if (error.response.data) {
        return error.response.data;
      }
    }

    console.error("Unexpected error in API request:", error);

    return {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
      code: "UNKNOWN_ERROR",
    } as T;
  }
}
