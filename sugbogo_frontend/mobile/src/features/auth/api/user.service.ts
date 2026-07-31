import apiClient from "@/shared/api/apiClient.service";
import { ApiSuccess } from "@/shared/types/apiResponse.types";
import { request } from "@/shared/api/request.service";

export function completeInterestSelection(): Promise<ApiSuccess> {
  return request(apiClient.patch<ApiSuccess>("/users/me/interests/"));
}
