import axios from "axios";
import { getAccessToken } from "@/shared/api/storage";
import { refreshSession } from "./refresh";
import { clearTokens } from "@/shared/api/storage";
import { useAuthStore } from "@/features/auth/store/auth.store";

const AUTH_ENDPOINTS = ["/auth/login/", "/auth/register/", "/auth/refresh/"];

// Create an Axios instance with a base URL and default headers.
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  validateStatus: (status) => status < 600,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Axios request interceptor.
 *
 * Adds the stored JWT access token to requests targeting protected endpoints.
 * Authentication endpoints are excluded since they do not require an existing
 * session and should not receive stale or expired access tokens.
 */
apiClient.interceptors.request.use(
  async (config) => {
    // Skip attaching tokens to public authentication endpoints.
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) =>
      config.url?.includes(endpoint),
    );

    if (isAuthEndpoint) {
      return config;
    }

    const token = await getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Axios response interceptor.
 *
 * Handles failed authenticated requests caused by expired access tokens.
 *
 * When the backend returns a 401 Unauthorized response, this interceptor:
 * - Prevents retrying the same request multiple times.
 * - Requests a new access token using the stored refresh token.
 * - Updates the failed request with the new access token.
 * - Retries the original request automatically.
 *
 * If refreshing fails, the error is rejected so the application can
 * handle session expiration (such as redirecting the user to login).
 */
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) =>
      originalRequest?.url?.includes(endpoint),
    );

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

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
        await clearTokens();

        useAuthStore.getState().clearUser();

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
