import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import {
  CategoryOption,
  ClusterOption,
  SpecialtyTagOption,
} from "../types/merchantRegistration.types";
import {
  ApplicationDocumentPayload,
  ApplicationDocumentResponse,
  ApplicationIdentityPayload,
  ApplicationIdentityResponse,
  ApplicationLocationPayload,
  ApplicationLocationResponse,
  ApplicationOperatingHoursPayload,
  ApplicationOperatingHoursResponse,
  ApplicationPhotoPayload,
  ApplicationDetailResponse,
  ApplicationPhotoResponse,
} from "../types/registration/registrationApi.types";

// Registration options

export async function getClusters(): Promise<ApiResponse<ClusterOption[]>> {
  return request(apiClient.get("/merchant/application/clusters/"));
}

export async function getCategories(): Promise<ApiResponse<CategoryOption[]>> {
  return request(apiClient.get("/merchant/application/categories/"));
}

export async function getSpecialtyTags(): Promise<
  ApiResponse<SpecialtyTagOption[]>
> {
  return request(apiClient.get("/merchant/application/specialty-tags/"));
}

// Application

export async function getCurrentApplication(): Promise<
  ApiResponse<ApplicationDetailResponse>
> {
  return request(apiClient.get("/merchant/application/"));
}

// Step 1 — Business Identity

export async function saveApplicationIdentity(
  payload: ApplicationIdentityPayload,
): Promise<ApiResponse<ApplicationIdentityResponse>> {
  return request(apiClient.patch("/merchant/application/identity/", payload));
}

// Step 2 — Business Location

export async function saveApplicationLocation(
  payload: ApplicationLocationPayload,
): Promise<ApiResponse<ApplicationLocationResponse>> {
  return request(apiClient.patch("/merchant/application/location/", payload));
}

// Step 3 — Operating Hours

export async function saveApplicationOperatingHours(
  payload: ApplicationOperatingHoursPayload,
): Promise<ApiResponse<ApplicationOperatingHoursResponse[]>> {
  return request(
    apiClient.put("/merchant/application/operating-hours/", payload),
  );
}

// Step 4 — Business Photos

export async function saveApplicationPhotos(
  formData: FormData,
): Promise<ApiResponse<ApplicationPhotoResponse[]>> {
  return request(
    apiClient.patch("/merchant/application/photos/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  );
}

// Step 5 — Verification Documents
export async function saveApplicationDocuments(
  formData: FormData,
): Promise<ApiResponse<ApplicationDocumentResponse[]>> {
  return request(
    apiClient.patch("/merchant/application/documents/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
  );
}

// Final submission

export async function submitApplication(): Promise<
  ApiResponse<ApplicationDetailResponse>
> {
  return request(apiClient.post("/merchant/application/submit/"));
}
