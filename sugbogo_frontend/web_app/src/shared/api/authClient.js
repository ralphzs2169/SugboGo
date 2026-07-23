import axios from "axios";

/**
 * Create an Axios instance for authentication-related API requests.
 * This instance can be used to make requests to the authentication endpoints.
 */
const authClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default authClient;
