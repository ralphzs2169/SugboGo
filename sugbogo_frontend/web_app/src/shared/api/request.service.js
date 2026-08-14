import axios from "axios";

/**
 * Executes an API request and returns the backend's standardized response.
 *
 * Backend errors are returned directly so callers can handle
 * `success`, `message`, `code`, and `errors` consistently.
 */
export async function request(promise) {
  try {
    const response = await promise;

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      return error.response.data;
    }

    return {
      success: false,
      message: "Unable to complete the request.",
      code: "UNKNOWN_ERROR",
    };
  }
}
