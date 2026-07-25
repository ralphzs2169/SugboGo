import apiClient from "@/shared/api/apiClient";
import { ApiSuccess } from "@/shared/api/types";
import { request } from "@/shared/api/request";

export function completeInterestSelection(): Promise<ApiSuccess> {
  return request(apiClient.patch<ApiSuccess>("/users/me/interests/"));
}
