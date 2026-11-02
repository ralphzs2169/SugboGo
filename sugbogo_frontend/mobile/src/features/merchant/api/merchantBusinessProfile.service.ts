import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type {
  MerchantBusinessProfileResponse,
  MerchantBusinessInformationResponse,
  MerchantBusinessInformationUpdate,
  MerchantCoverPhotoUpdateResponse,
  MerchantBusinessOperatingHours,
  MerchantBusinessOperatingHoursUpdate,
  MerchantBusinessPhoto,
} from "../types/merchantBusinessProfile.types";

export async function getMerchantBusinessProfile(): Promise<
  ApiResponse<MerchantBusinessProfileResponse>
> {
  return request(apiClient.get("/merchant/business-profile/"));
}

export async function getMerchantVerificationDocumentAccess(
  documentId: number,
): Promise<ApiResponse<{ url: string; expires_in: number }>> {
  return request(
    apiClient.get(
      `/merchant/business-profile/verification-documents/${documentId}/access/`,
    ),
  );
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

export async function updateMerchantBusinessOperatingHours(
  schedule: MerchantBusinessOperatingHoursUpdate,
): Promise<ApiResponse<MerchantBusinessOperatingHours[]>> {
  return request(
    apiClient.put("/merchant/business-profile/operating-hours/", schedule),
  );
}

export async function updateMerchantBusinessPhotos(
  formData: FormData,
): Promise<ApiResponse<MerchantBusinessPhoto[]>> {
  return request(
    apiClient.patch("/merchant/business-profile/photos/", formData),
  );
}

export type MerchantBusinessStatus = {
  business_id: number;
  status: "active" | "suspended";
  transition_id: number;
  owner_account_status: string;
  suspension_reason: string | null;
  updated_at: string;
};

/** Retrieve only the signed-in merchant's authoritative listing status and explanation. */
export function getMerchantBusinessStatus(
  signal?: AbortSignal,
): Promise<ApiResponse<MerchantBusinessStatus>> {
  return request(
    apiClient.get("/merchant/business-profile/status/", { signal }),
  );
}
