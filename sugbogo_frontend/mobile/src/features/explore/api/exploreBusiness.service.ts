import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  ExploreBusinessDetail,
  ExploreBusinessListResponse,
} from "../types/exploreBusiness.types";

export async function getNewBusinesses(): Promise<
  ApiResponse<ExploreBusinessListResponse>
> {
  return request(apiClient.get("/explorer/explore/new-businesses/"));
}

export async function getExploreBusinessDetail(
  businessId: number,
): Promise<ApiResponse<ExploreBusinessDetail>> {
  return request(apiClient.get(`/explorer/explore/businesses/${businessId}/`));
}

export async function vouchForBusinessSpecialty(
  businessId: number,
  tagId: number,
  installationId: string,
): Promise<
  ApiResponse<{
    id: number;
    business_id: number;
    tag_id: number;
    is_vouched: boolean;
  }>
> {
  return request(
    apiClient.post(`/explorer/explore/businesses/${businessId}/vouch/`, {
      tag_id: tagId,
      device_id: installationId,
    }),
  );
}

export async function removeBusinessSpecialtyVouch(
  businessId: number,
  tagId: number,
): Promise<
  ApiResponse<{
    business_id: number;
    tag_id: number;
    is_vouched: boolean;
  }>
> {
  return request(
    apiClient.delete(`/explorer/explore/businesses/${businessId}/vouch/`, {
      data: {
        tag_id: tagId,
      },
    }),
  );
}
