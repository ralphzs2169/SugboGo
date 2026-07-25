import axios from "axios";
import { API_ERROR_NAMES } from "./errors";

/**
 * Executes an API request and returns a standardized response.
 *
 * Successful requests return the response data. Axios and tagged errors
 * are normalized into the application's standard API response format,
 * allowing callers to handle all failures consistently.
 *
 * @template T - The expected API response type.
 * @param promise - The Axios request promise.
 * @returns The API response.
 */
export async function request<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    // Handle tagged errors returned by apiClient. These are converted into
    // the application's standard API response format so callers can handle
    // them the same way as backend responses.

    if (error instanceof Error) {
      switch (error.name) {
        // The user's session has expired and they must sign in again.
        case API_ERROR_NAMES.AUTH_ERROR:
          return {
            success: false,
            message: "Session expired.",
            code: "SESSION_EXPIRED",
          } as T;

        // No connection to the server.
        case API_ERROR_NAMES.NETWORK_ERROR:
          return {
            success: false,
            message:
              "Unable to connect to the server. Check your internet connection.",
            code: "NETWORK_ERROR",
          } as T;

        // The request exceeded the configured timeout.
        case API_ERROR_NAMES.REQUEST_TIMEOUT:
          return {
            success: false,
            message: "The server took too long to respond. Please try again.",
            code: "REQUEST_TIMEOUT",
          } as T;
      }
    }

    // Handle structured error responses returned by the backend.
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data;
    }

    console.log("isAxiosError:", axios.isAxiosError(error));

    if (axios.isAxiosError(error)) {
      console.log("name:", error.name);
      console.log("message:", error.message);
      console.log("code:", error.code);
      console.log("response:", error.response);
    }

    return {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
      code: "UNKNOWN_ERROR",
    } as T;
  }
}
