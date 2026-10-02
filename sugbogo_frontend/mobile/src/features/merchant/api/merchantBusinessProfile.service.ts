import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  MerchantBusinessProfileResponse,
  MerchantBusinessInformationResponse,
  MerchantBusinessInformationUpdate,
  MerchantCoverPhotoUpdateResponse,
} from "../types/merchantBusinessProfile.types";

export async function getMerchantBusinessProfile(): Promise<
  ApiResponse<MerchantBusinessProfileResponse>
> {
  return request(apiClient.get("/merchant/business-profile/"));
}

export async function updateMerchantBusinessInformation(
  changes: MerchantBusinessInformationUpdate,
): Promise<ApiResponse<MerchantBusinessInformationResponse>> {
  return request(
    apiClient.patch("/merchant/business-profile/information/", changes),
  );
}

export async function updateMerchantBusinessCoverPhoto(
  formData: FormData,
): Promise<ApiResponse<MerchantCoverPhotoUpdateResponse>> {
  return request(
    apiClient.patch("/merchant/business-profile/cover-photo/", formData),
  );
}
