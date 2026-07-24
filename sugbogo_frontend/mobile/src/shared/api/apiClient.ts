import axios from "axios";
import { router } from "expo-router";
import { getAccessToken, clearTokens } from "@/shared/api/storage";
import { refreshSession } from "./refresh";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { Toast } from "react-native-toast-message/lib/src/Toast";

let isRedirectingToLogin = false;

// Axios client for authenticated endpoints.
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Axios request interceptor.
 *
 * Attaches the stored JWT access token to authenticated requests.
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
 * Refreshes expired access tokens automatically.
 * If refreshing fails, clears the session and redirects to login.
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
      } catch {
        // If refreshing the token fails, clear the session and redirect to login.
        await clearTokens();
        useAuthStore.getState().clearUser();

        if (!isRedirectingToLogin) {
          isRedirectingToLogin = true;

          Toast.show({
            type: "error",
            text1: "Session Expired",
            text2: "Please sign in again.",
          });

          setTimeout(() => {
            router.replace("/(auth)/login");
          }, 1000);
        }

        // Create a custom error to indicate that the session has expired.
        const authError = new Error("SESSION_EXPIRED");
        authError.name = "AUTH_ERROR";

        return Promise.reject(authError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
