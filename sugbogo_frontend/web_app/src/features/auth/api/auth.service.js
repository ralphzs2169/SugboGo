import apiClient from "@/shared/api/apiClient";

export async function login(credentials) {
  const response = await apiClient.post("/auth/admin/login/", credentials);

  return response.data;
}

export async function getCurrentUser() {
  const response = await apiClient.get("/users/me/");

  return response.data.data;
}

export async function refreshAccessToken(refreshToken) {
  const response = await apiClient.post("/auth/refresh/", {
    refresh: refreshToken,
  });

  return response.data;
}
