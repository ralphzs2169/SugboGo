import type { ExploreBusinessListResponse } from "@/features/explore/types/exploreBusiness.types";
import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  BusinessPocketMemberships,
  PocketCollection,
  PocketCollectionListResponse,
} from "../types/pockets.types";

/** Loads one authenticated collection page, leaving omitted page size to the server. */
export function getPocketCollections(
  page = 1,
  pageSize?: number,
): Promise<ApiResponse<PocketCollectionListResponse>> {
  return request(
    apiClient.get("/explorer/explore/pockets/", {
      params: {
        page,
        ...(pageSize === undefined ? {} : { page_size: pageSize }),
      },
    }),
  );
}

/** Loads metadata for one owned collection, including its available-business count. */
export function getPocketCollection(
  collectionId: number,
): Promise<ApiResponse<PocketCollection>> {
  return request(apiClient.get(`/explorer/explore/pockets/${collectionId}/`));
}

/** Loads one page of available saved businesses in the backend's membership order. */
export function getPocketCollectionBusinesses(
  collectionId: number,
  page = 1,
  pageSize?: number,
): Promise<ApiResponse<ExploreBusinessListResponse>> {
  return request(
    apiClient.get(`/explorer/explore/pockets/${collectionId}/businesses/`, {
      params: {
        page,
        ...(pageSize === undefined ? {} : { page_size: pageSize }),
      },
    }),
  );
}

/** Reads the complete selection, including collections outside loaded pages. */
export function getBusinessPocketMemberships(
  businessId: number,
  signal?: AbortSignal,
): Promise<ApiResponse<BusinessPocketMemberships>> {
  const url = `/explorer/explore/businesses/${businessId}/pockets/`;
  return request(signal ? apiClient.get(url, { signal }) : apiClient.get(url));
}

/** Replaces all memberships atomically; an empty selection removes every save. */
export function replaceBusinessPocketMemberships(
  businessId: number,
  pocketIds: number[],
): Promise<ApiResponse<BusinessPocketMemberships>> {
  return request(
    apiClient.put(`/explorer/explore/businesses/${businessId}/pockets/`, {
      pocket_ids: pocketIds,
    }),
  );
}

/** Creates an empty custom Pocket; the server normalizes and validates its name. */
export function createPocketCollection(
  name: string,
): Promise<ApiResponse<PocketCollection>> {
  return request(apiClient.post("/explorer/explore/pockets/", { name }));
}

/** Renames an owned custom Pocket without changing its memberships. */
export function renamePocketCollection(
  collectionId: number,
  name: string,
): Promise<ApiResponse<PocketCollection>> {
  return request(
    apiClient.patch(`/explorer/explore/pockets/${collectionId}/`, { name }),
  );
}

/** Deletes one custom collection; the backend retains businesses saved elsewhere. */
export function deletePocketCollection(
  collectionId: number,
): Promise<ApiResponse<{ id: number }>> {
  return request(
    apiClient.delete(`/explorer/explore/pockets/${collectionId}/`),
  );
}

/** Removes only this membership and returns the authoritative remaining selection. */
export function removePocketCollectionBusiness(
  collectionId: number,
  businessId: number,
): Promise<ApiResponse<BusinessPocketMemberships>> {
  return request(
    apiClient.delete(
      `/explorer/explore/pockets/${collectionId}/businesses/${businessId}/`,
    ),
  );
}
