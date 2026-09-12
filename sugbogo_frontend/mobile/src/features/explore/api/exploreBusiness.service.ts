import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  ExploreBusiness,
  ExploreBusinessDetail,
  ExploreBusinessListResponse,
  DiscoveryShortcut,
  ExploreSpecialty,
  RecommendationBusinessListResponse,
  ExploreMapPreviewBusiness,
  ExploreFilterOptions,
  ExploreResultsCriteria,
  ExploreCollectionCriteria,
  ExploreCollectionType,
  ExploreCollectionBusinessListResponse,
} from "../types/exploreBusiness.types";

export async function getNewBusinesses(): Promise<
  ApiResponse<ExploreBusinessListResponse>
> {
  return request(apiClient.get("/explorer/explore/new-businesses/"));
}

export async function getDiscoveryFeed(): Promise<
  ApiResponse<ExploreBusinessListResponse>
> {
  return request(apiClient.get("/explorer/explore/discovery/"));
}

export async function getDiscoveryResults(
  criteria: ExploreResultsCriteria,
  page: number,
): Promise<ApiResponse<ExploreBusinessListResponse>> {
  const params = new URLSearchParams();

  if (criteria.search.trim()) {
    params.set("search", criteria.search.trim());
  }

  if (criteria.clusterId !== null) {
    params.set("cluster", String(criteria.clusterId));
  }

  for (const categoryId of criteria.categoryIds) {
    params.append("category", String(categoryId));
  }

  if (criteria.specialtyTagId !== null) {
    params.set("specialty_tag", String(criteria.specialtyTagId));
  }

  params.set("page", String(page));

  return request(
    apiClient.get("/explorer/explore/discovery/", {
      params,
    }),
  );
}

export async function getExploreCollection(
  collectionType: ExploreCollectionType,
  criteria: ExploreCollectionCriteria,
  page: number,
): Promise<ApiResponse<ExploreCollectionBusinessListResponse>> {
  const params = new URLSearchParams();

  if (criteria.clusterId !== null) {
    params.set("cluster", String(criteria.clusterId));
  }

  for (const categoryId of criteria.categoryIds) {
    params.append("category", String(categoryId));
  }

  if (criteria.specialtyTagId !== null) {
    params.set("specialty_tag", String(criteria.specialtyTagId));
  }

  params.set("page", String(page));

  return request(
    apiClient.get(`/explorer/explore/collections/${collectionType}/`, {
      params,
    }),
  );
}

export async function getExploreFilterOptions(): Promise<
  ApiResponse<ExploreFilterOptions>
> {
  return request(apiClient.get("/explorer/explore/filter-options/"));
}

export async function getExploreSpecialties(): Promise<
  ApiResponse<ExploreSpecialty[]>
> {
  return request(apiClient.get("/explorer/explore/specialties/"));
}

export async function getDiscoveryShortcuts(): Promise<
  ApiResponse<DiscoveryShortcut[]>
> {
  return request(apiClient.get("/explorer/explore/discovery-shortcuts/"));
}

export async function getRecommendations(): Promise<
  ApiResponse<RecommendationBusinessListResponse>
> {
  return request(apiClient.get("/explorer/explore/recommendations/"));
}

export async function getExploreBusinessDetail(
  businessId: number,
): Promise<ApiResponse<ExploreBusinessDetail>> {
  return request(apiClient.get(`/explorer/explore/businesses/${businessId}/`));
}

export async function getSimilarBusinesses(
  businessId: number,
): Promise<ApiResponse<ExploreBusiness[]>> {
  return request(
    apiClient.get(`/explorer/explore/businesses/${businessId}/similar/`),
  );
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

export async function pocketBusiness(businessId: number): Promise<
  ApiResponse<{
    id: number;
    business_id: number;
    is_pocketed: boolean;
  }>
> {
  return request(
    apiClient.post(`/explorer/explore/businesses/${businessId}/pocket/`),
  );
}

export async function removeBusinessFromPocket(businessId: number): Promise<
  ApiResponse<{
    business_id: number;
    is_pocketed: boolean;
  }>
> {
  return request(
    apiClient.delete(`/explorer/explore/businesses/${businessId}/pocket/`),
  );
}

export async function recordBusinessImpressions(businessIds: number[]): Promise<
  ApiResponse<{
    business_ids: number[];
    recorded_count: number;
    duplicate_count: number;
  }>
> {
  return request(
    apiClient.post("/explorer/explore/visibility/impressions/", {
      business_ids: businessIds,
    }),
  );
}

export async function recordBusinessProfileVisit(businessId: number): Promise<
  ApiResponse<{
    business_id: number;
    recorded: boolean;
    duplicate: boolean;
  }>
> {
  return request(
    apiClient.post(`/explorer/explore/businesses/${businessId}/profile-visit/`),
  );
}

export async function getMapPreviewBusinesses(
  latitude: number,
  longitude: number,
): Promise<ApiResponse<ExploreMapPreviewBusiness[]>> {
  return request(
    apiClient.get("/explorer/explore/map-preview/", {
      params: {
        latitude,
        longitude,
      },
    }),
  );
}
