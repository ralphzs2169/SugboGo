import axios from "axios";
import { router } from "expo-router";
import { getAccessToken, clearTokens } from "@/shared/api/storage.service";
import { refreshSession } from "./refresh.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { createApiError } from "@/shared/utils/apiErrors";
import { API_ERROR_CODE } from "@/shared/constants/errorCodes";
import NetInfo from "@react-native-community/netinfo";

/**
 * Axios client for authenticated endpoints.
 *
 * This client automatically attaches the user's access token and
 * transparently refreshes expired access tokens. It should be used for
 * endpoints that require an authenticated session.
 */
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * REQUEST INTERCEPTOR
 * Runs before every outgoing request.
 *
 * 1. Verifies that the device has an active internet connection.
 * 2. Attaches the stored JWT access token, if one exists.
 *
 * If the device is offline, the request is rejected immediately with a
 * standardized API error instead of waiting for the request to fail or
 * time out.
 */
apiClient.interceptors.request.use(
  async (config) => {
    const netState = await NetInfo.fetch();

    // Verify network connectivity before sending the request.
    if (!netState.isConnected || netState.isInternetReachable === false) {
      return Promise.reject(createApiError(API_ERROR_CODE.NETWORK_ERROR));
    }

    // Attach the current access token, if available.
    const token = await getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * RESPONSE INTERCEPTOR
 * Runs whenever a request fails.
 *
 * Handles three categories of failures:
 *
 * 1. Transport-level failures (e.g. network unavailable or request timeout)
 *    are converted into standardized API errors.
 * 2. Expired access tokens (401) are refreshed automatically and the
 *    original request is retried once.
 * 3. If the refresh token is no longer valid, the local session is
 *    cleared and the user is redirected to the login screen.
 *
 * Any other HTTP response (4xx/5xx) is passed through unchanged so
 * request.ts can return the backend's structured error response.
 */
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    // Transport-level failures do not receive an HTTP response.
    // Convert them into standardized API errors so request.ts can
    // normalize them into the application's standard API response format.
    if (axios.isAxiosError(error) && !error.response) {
      const isTimeout = error.code === "ECONNABORTED";

      const errorName = isTimeout
        ? API_ERROR_CODE.REQUEST_TIMEOUT
        : API_ERROR_CODE.NETWORK_ERROR;

      return Promise.reject(createApiError(errorName));
    }

    const originalRequest = error.config;

    // Retry requests once after silently refreshing an expired
    // access token. The _retry flag prevents infinite refresh loops.
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshSession();

        // Re-attach the new token and retry the original request.
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };

        return apiClient(originalRequest);
      } catch {
        // Refreshing failed, meaning the session is no longer valid.
        // Clear the local session, redirect the user to the login screen,
        // and set a flag so the login screen can display a one-time
        // "Your session has expired" message.
        await clearTokens();
        useAuthStore.getState().clearUser();

        useAuthStore.getState().setSessionExpired(true);

        router.replace("/(auth)/login");

        return Promise.reject(createApiError(API_ERROR_CODE.AUTH_ERROR));
      }
    }
    // Preserve structured backend error responses (4xx/5xx) so request.ts
    // can return them unchanged to the caller.
    return Promise.reject(error);
  },
);

export default apiClient;
