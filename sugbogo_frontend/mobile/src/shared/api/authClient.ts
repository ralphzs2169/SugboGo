import axios from "axios";

/**
 * Axios client for authentication requests.
 *
 * Does not contain authentication interceptors because
 * login and token refresh must work without an access token.
 */
const authClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default authClient;
