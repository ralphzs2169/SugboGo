import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import {
  CategoryOption,
  ClusterOption,
  SpecialtyTagOption,
} from "../types/registration/registrationOption.types";
import {
  ApplicationDetailResponse,
  ApplicationDocumentResponse,
  ApplicationIdentityPayload,
  ApplicationIdentityResponse,
  ApplicationLocationPayload,
  ApplicationLocationResponse,
  ApplicationOperatingHoursPayload,
  ApplicationOperatingHoursResponse,
  ApplicationPhotoResponse,
  ApplicationStatusResponse,
  ApplicationSubmissionResponse,
} from "../types/registration/registrationApi.types";
import { MerchantApplicationStatus } from "@/shared/types/userInformation.types";

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
  return request(apiClient.patch("/merchant/application/photos/", formData));
}

export async function saveApplicationDocuments(
  formData: FormData,
): Promise<ApiResponse<ApplicationDocumentResponse[]>> {
  return request(apiClient.patch("/merchant/application/documents/", formData));
}

// Final submission

export async function submitApplication(): Promise<
  ApiResponse<ApplicationSubmissionResponse>
> {
  return request(apiClient.post("/merchant/application/submit/"));
}

export async function getApplicationStatus(): Promise<
  ApiResponse<ApplicationStatusResponse | null>
> {
  return request(apiClient.get("/merchant/application/status/"));
}
