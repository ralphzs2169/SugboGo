import apiClient from "@/shared/api/apiClient";
import { ApiSuccess } from "@/shared/api/types";

export async function completeInterestSelection(): Promise<ApiSuccess> {
  const response = await apiClient.patch<ApiSuccess>("/users/me/interests/");

  return response.data;
}
