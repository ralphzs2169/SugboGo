import axios from "axios";
import { getAccessToken } from "@/shared/api/storage";
import { refreshSession } from "./refresh";
import { clearTokens } from "@/shared/api/storage";
import { useAuthStore } from "@/features/auth/store/auth.store";

// Axios client for authenticated endpoints.
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 30000,
  validateStatus: (status) => status < 600,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Axios request interceptor.
 *
 * Attaches the stored JWT access token to every request made through
 * this client. This client is intended only for authenticated endpoints.
 */
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * Axios response interceptor.
 *
 * Automatically refreshes expired access tokens for authenticated requests.
 *
 * When a request receives a 401 Unauthorized response, this interceptor:
 * - Prevents retrying the same request multiple times.
 * - Obtains a new access token using the refresh token.
 * - Retries the original request with the new access token.
 *
 * If the refresh fails, the stored session is cleared and the error is
 * propagated so the application can redirect the user to sign in.
 */
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
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
        await clearTokens();
        useAuthStore.getState().clearUser();

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
