import apiClient from "@/shared/api/apiClient.service";
import { ApiSuccess } from "@/shared/types/apiResponse.types";
import { request } from "@/shared/api/request.service";

export function completeInterestSelection(
  specialtyTagIds: number[] = [],
): Promise<ApiSuccess> {
  return request(
    apiClient.patch<ApiSuccess>("/users/me/interests/", {
      specialty_tag_ids: specialtyTagIds,
    }),
  );
}
