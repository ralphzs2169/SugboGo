import apiClient from "@/shared/api/apiClient";
import authClient from "@/shared/api/authClient";

/**
 * Authentication service for handling user login, session restoration, and token refresh.
 * This service provides functions to interact with the authentication API endpoints.
 */

export async function login(credentials) {
  const response = await authClient.post("/auth/admin/login/", credentials);

  return response.data;
}

export async function getCurrentUser() {
  const response = await apiClient.get("/users/me/");

  return response.data.data;
}

export async function refreshAccessToken(refreshToken) {
  const response = await authClient.post("/auth/refresh/", {
    refresh: refreshToken,
  });

  return response.data;
}
