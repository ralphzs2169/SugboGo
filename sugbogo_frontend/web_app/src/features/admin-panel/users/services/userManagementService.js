import apiClient from "@/shared/api/apiClient";

const BASE_URL = "/admin/users/";

export async function fetchUsers(params = {}) {
  const response = await apiClient.get(BASE_URL, {
    params,
  });

  return response.data.data;
}

export async function fetchUser(userId) {
  const response = await apiClient.get(`${BASE_URL}${userId}/`);

  return response.data.data;
}

export async function fetchUserActivity(userId, params = {}) {
  const response = await apiClient.get(`${BASE_URL}${userId}/activity/`, {
    params,
  });

  return response.data.data;
}

export async function fetchUserAdministrativeHistory(userId, params = {}) {
  const response = await apiClient.get(
    `${BASE_URL}${userId}/administrative-history/`,
    {
      params,
    },
  );

  return response.data.data;
}

export async function suspendUser(userId, reason) {
  const response = await apiClient.post(`${BASE_URL}${userId}/suspend/`, {
    reason,
  });

  return response.data;
}

export async function reactivateUser(userId) {
  const response = await apiClient.post(`${BASE_URL}${userId}/reactivate/`);

  return response.data;
}
