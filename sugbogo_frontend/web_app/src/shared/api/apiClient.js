import axios from "axios";

import { refreshSession } from "./refresh";
import { getAccessToken, clearTokens } from "./storage";

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

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
