import axios from "axios";
import { getAccessToken } from "@/shared/api/storage";

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

export default apiClient;
