import axios from "axios";
import { getAccessToken } from "@/shared/api/storage";
import { refreshSession } from "./refresh";

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Axios request interceptor.
 *
 * Automatically attaches the stored JWT access token to outgoing API requests.
 * This allows authenticated endpoints to identify the current user without
 * manually adding authorization headers in every service function.
 */
apiClient.interceptors.request.use(
  async (config) => {
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshSession();

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        console.log("Refresh failed:", refreshError);

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
