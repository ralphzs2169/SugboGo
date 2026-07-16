import apiClient from "@/shared/api/apiClient";

export async function completeInterestSelection() {
  const response = await apiClient.patch("/users/me/interests/");

  return response.data;
}
