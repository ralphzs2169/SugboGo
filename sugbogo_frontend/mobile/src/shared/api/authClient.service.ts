import axios from "axios";
import NetInfo from "@react-native-community/netinfo";
import { classifyDeviceConnectivity } from "@/shared/network/deviceConnectivity";
import { API_ERROR_CODE } from "../constants/errorCodes";
import { createApiError } from "../utils/apiErrors";

/**
 * Axios client for public authentication endpoints.
 *
 * Unlike apiClient, this client does not attach access tokens or perform
 * automatic token refresh. It is intended for endpoints that can be accessed
 * without an authenticated session (e.g. login, registration, password reset).
 */
const authClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 20000,
  validateStatus: (status) => status < 600,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * REQUEST INTERCEPTOR
 * Runs before every outgoing request.
 *
 * Rejects confirmed disconnection immediately. An undetermined native state
 * still allows authentication requests, including refresh.
 */
authClient.interceptors.request.use(async (config) => {
  const netState = await NetInfo.fetch();

  if (classifyDeviceConnectivity(netState) === "offline") {
    return Promise.reject(createApiError(API_ERROR_CODE.NETWORK_ERROR));
  }

  return config;
});

/**
 * RESPONSE INTERCEPTOR
 * Runs whenever a request fails.
 *
 * Network failures and request timeouts do not receive an HTTP response,
 * so Axios reports them as transport-level errors. These are converted
 * into standardized API errors that request.ts can normalize into the
 * application's standard API response format.
 *
 * HTTP responses (4xx/5xx) are passed through unchanged so callers can
 * access the backend's structured error payload.
 */
authClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && !error.response) {
      const isTimeout = error.code === "ECONNABORTED";

      const errorName = isTimeout
        ? API_ERROR_CODE.REQUEST_TIMEOUT
        : API_ERROR_CODE.NETWORK_ERROR;

      return Promise.reject(createApiError(errorName));
    }

    return Promise.reject(error);
  },
);
export default authClient;
