import axios from "axios";
import { router } from "expo-router";
import { getAccessToken, clearTokens } from "@/shared/api/storage";
import { refreshSession } from "./refresh";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { API_ERROR_NAMES, createTaggedError } from "@/shared/api/errors";

// TODO: uncomment once @react-native-community/netinfo is installed
// AND the dev client has been rebuilt (native module — JS-only reload
// won't pick it up). See conversation notes: npx expo install
// @react-native-community/netinfo, then rebuild via expo run:ios/android
// or eas build --profile development.
// import NetInfo from "@react-native-community/netinfo";

// Axios client for authenticated endpoints.
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * REQUEST INTERCEPTOR
 * Runs before every outgoing request.
 *
 * 1. Attaches the stored JWT access token, if one exists.
 * 2. (Once NetInfo is enabled) Checks device connectivity BEFORE sending.
 *    This lets us fail fast with NETWORK_ERROR when there's clearly no
 *    connection, instead of waiting up to `timeout` (20s) for a request
 *    that was never going to succeed — see errors.ts for why that delay
 *    happens without this check.
 */
apiClient.interceptors.request.use(
  async (config) => {
    // TODO: uncomment once NetInfo is installed + rebuilt
    // const netState = await NetInfo.fetch();
    //
    // if (!netState.isConnected) {
    //   // Reject here, before the request is ever sent. This throws
    //   // synchronously into the SAME catch block in request.ts that
    //   // already handles NETWORK_ERROR from the response interceptor —
    //   // no changes needed there.
    //   return Promise.reject(
    //     createTaggedError(API_ERROR_NAMES.NETWORK_ERROR, "NETWORK_ERROR"),
    //   );
    // }
    const token = await getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * RESPONSE INTERCEPTOR
 * Runs whenever a request fails. Handles three cases, in order:
 *
 *   1. Network / timeout errors — convert them into tagged errors.
 *   2. Expired access token (401) — silently refresh and retry once.
 *   3. Expired refresh token — clear the session, redirect to login,
 *      and mark the session as expired so the login screen can inform
 *      the user.
 *   4. Any other HTTP error — pass through as an AxiosError so
 *      request.ts can return the backend's structured response.
 */
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    console.log("🔥 Response interceptor reached");
    // Case 1: Network error or timeout
    // `error.response` is undefined when no response was ever received
    // (offline, DNS failure, server unreachable, or the request timed
    // out). We re-throw as a plain, "tagged" Error instead of the raw
    // AxiosError, so request.ts can identify it by name — see errors.ts.
    if (axios.isAxiosError(error) && !error.response) {
      const isTimeout = error.code === "ECONNABORTED";

      console.log("Axios code:", error.code);
      console.log("Has response:", !!error.response);

      return Promise.reject(
        createTaggedError(
          isTimeout
            ? API_ERROR_NAMES.REQUEST_TIMEOUT
            : API_ERROR_NAMES.NETWORK_ERROR,
          isTimeout ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        ),
      );
    }

    const originalRequest = error.config;

    // Case 2: Expired access token (401), not yet retried
    // `_retry` is a flag we stamp onto the request config so we only
    // ever attempt ONE silent refresh per request. Without it, a
    // request that fails again after refreshing could loop forever.
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
        // Refreshing itself failed, meaning both the access and refresh
        // tokens are no longer usable. Clear the local session, mark it as
        // expired, and redirect to the login screen. The login screen reads
        // the sessionExpired flag to display a one-time message to the user.
        await clearTokens();
        useAuthStore.getState().clearUser();

        // Lets the login screen display a one-time
        // "Your session has expired" message after redirecting.
        useAuthStore.getState().setSessionExpired(true);

        router.replace("/(auth)/login");

        return Promise.reject(
          createTaggedError(API_ERROR_NAMES.AUTH_ERROR, "SESSION_EXPIRED"),
        );
      }
    }

    // Case 3: Any other error (4xx/5xx with a real response)
    // Left as-is — a genuine AxiosError — so request.ts can read
    // error.response.data, which is the backend's structured payload
    // from success_response/error_response.
    return Promise.reject(error);
  },
);

export default apiClient;
