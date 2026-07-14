import axios from "axios";

/**
 * Shared Axios client for general API requests.
 */
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Shared Axios client for admin panel API requests.
 */
export const adminPanelApi = axios.create({
  baseURL: "http://127.0.0.1:8000/api/admin-panel",
  headers: {
    "Content-Type": "application/json",
  },
});
