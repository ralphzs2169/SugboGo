import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import {
  CategoryOption,
  ClusterOption,
  SpecialtyTagOption,
} from "../types/merchantRegistration.types";

export async function getClusters(): Promise<ApiResponse<ClusterOption[]>> {
  return request(apiClient.get("/registration/clusters/"));
}

export async function getCategories(): Promise<ApiResponse<CategoryOption[]>> {
  return request(apiClient.get("/registration/categories/"));
}

export async function getSpecialtyTags(): Promise<
  ApiResponse<SpecialtyTagOption[]>
> {
  return request(apiClient.get("/registration/specialty-tags/"));
}
