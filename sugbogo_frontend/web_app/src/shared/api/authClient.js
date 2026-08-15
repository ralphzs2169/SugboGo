import axios from "axios";

import { attachSyntheticResponse } from "./apiErrors";
import { API_ERROR_CODE } from "./errorCodes";

/**
 * Create an Axios instance for authentication-related API requests.
 * This instance can be used to make requests to the authentication endpoints.
 *
 * Unlike apiClient, this client does not attach access tokens or perform
 * automatic token refresh — it stays separate so refreshSession() (which
 * uses this client) can never itself trigger apiClient's 401/refresh
 * interceptor.
 */
const authClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Normalize transport-level failures (network unavailable, request
// timeout) into the backend's standard error response shape, so
// callers can read `error.response?.data?.message` the same way they
// already do for backend-returned errors. Structured backend responses
// (4xx/5xx) pass through unchanged.
authClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && !error.response) {
      const code =
        error.code === "ECONNABORTED"
          ? API_ERROR_CODE.REQUEST_TIMEOUT
          : API_ERROR_CODE.NETWORK_ERROR;

      return Promise.reject(attachSyntheticResponse(error, code));
    }

    return Promise.reject(error);
  },
);

export default authClient;
