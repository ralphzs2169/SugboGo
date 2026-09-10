import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  UpdateInterestsPayload,
  UserInterests,
} from "../types/interest.types";

export function getUserInterests(): Promise<ApiResponse<UserInterests>> {
  return request(apiClient.get("/users/me/interests/"));
}

export function completeOnboardingInterests(
  specialtyTagIds: number[],
): Promise<ApiResponse<UserInterests>> {
  return request(
    apiClient.patch("/users/me/interests/", {
      specialty_tag_ids: specialtyTagIds,
    }),
  );
}

export function updateUserInterests(
  payload: UpdateInterestsPayload,
): Promise<ApiResponse<UserInterests>> {
  return request(apiClient.put("/users/me/interests/", payload));
}
