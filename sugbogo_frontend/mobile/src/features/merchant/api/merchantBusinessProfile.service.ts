import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { MerchantBusinessProfileResponse } from "../types/merchantBusinessProfile.types";

export async function getMerchantBusinessProfile(): Promise<
  ApiResponse<MerchantBusinessProfileResponse>
> {
  return request(apiClient.get("/merchant/business-profile/"));
}

export async function updateMerchantBusinessCoverPhoto(
  formData: FormData,
): Promise<ApiResponse<MerchantBusinessProfileResponse>> {
  return request(
    apiClient.patch("/merchant/business-profile/cover-photo/", formData),
  );
}
