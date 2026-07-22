import axios from "axios";

/**
 * Axios client for public authentication endpoints.
 *
 * This client does not attach access tokens or perform automatic
 * token refresh. It is intended for endpoints that can be accessed
 * without an authenticated session.
 */
const authClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 30000,
  validateStatus: (status) => status < 600,
  headers: {
    "Content-Type": "application/json",
  },
});

export default authClient;
