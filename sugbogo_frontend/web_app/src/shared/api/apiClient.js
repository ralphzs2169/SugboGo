import axios from "axios";

import { refreshSession } from "./refresh";
import { getAccessToken, clearTokens } from "./storage";
import { attachSyntheticResponse } from "./apiErrors";
import { API_ERROR_CODE } from "./errorCodes";

import { useAuthStore } from "@/features/auth/storage/auth.store";

/**
 * Create an Axios instance for general API requests.
 * This instance automatically includes the access token in the Authorization header
 * and handles token refresh on 401 Unauthorized responses.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the access token in the Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Let the browser set the multipart Content-Type and boundary
    // itself — the manually configured JSON header would otherwise
    // be sent alongside FormData bodies and break the upload.
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// This interceptor checks for 401 Unauthorized responses and attempts to refresh the
// access token using the refresh token. If successful, it retries the original
// request with the new access token. If the refresh fails, it clears the tokens and user state.
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    // Transport-level failures never reach the backend, so they have no
    // `error.response`. Shape them like a backend error response so
    // existing callers' `error.response?.data?.message` handling works
    // the same way it already does for structured backend errors.
    if (axios.isAxiosError(error) && !error.response) {
      const code =
        error.code === "ECONNABORTED"
          ? API_ERROR_CODE.REQUEST_TIMEOUT
          : API_ERROR_CODE.NETWORK_ERROR;

      return Promise.reject(attachSyntheticResponse(error, code));
    }

    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshSession();

        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };

        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();

        useAuthStore.getState().clearUser();
        window.location.replace("/login");

        // If the refresh failed with a real backend response (e.g. the
        // refresh token was rejected), preserve it unchanged. Only
        // synthesize a message when there's genuinely nothing to show
        // (no stored refresh token, or the refresh request itself
        // never reached the server).
        return Promise.reject(
          attachSyntheticResponse(refreshError, API_ERROR_CODE.SESSION_EXPIRED),
        );
      }
    }

    // Preserve structured backend error responses (4xx/5xx) unchanged.
    return Promise.reject(error);
  },
);

export default apiClient;
