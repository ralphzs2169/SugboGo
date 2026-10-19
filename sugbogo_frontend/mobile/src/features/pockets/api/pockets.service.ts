import type { ExploreBusinessListResponse } from "@/features/explore/types/exploreBusiness.types";
import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
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
