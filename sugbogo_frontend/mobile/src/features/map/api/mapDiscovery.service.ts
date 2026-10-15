import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  MapBounds,
  MapDiscoveryResponse,
  MapDiscoveryFilters,
} from "../types/mapDiscovery.types";
import { DEFAULT_MAP_FILTERS } from "../types/mapDiscovery.types";
import { isSearchableBounds } from "../utils/mapViewport";

export async function getMapDiscoveryBusinesses(
  bounds: MapBounds,
  signal?: AbortSignal,
  filters: MapDiscoveryFilters = DEFAULT_MAP_FILTERS,
): Promise<ApiResponse<MapDiscoveryResponse>> {
  if (!isSearchableBounds(bounds)) {
    throw new Error("Zoom in to search this area.");
  }

  const params = new URLSearchParams({
    north: String(bounds.north),
    south: String(bounds.south),
    east: String(bounds.east),
    west: String(bounds.west),
    page: "1",
    page_size: "200",
  });

  if (filters.clusterId !== null) {
    params.set("cluster", String(filters.clusterId));
  }

  for (const categoryId of filters.categoryIds) {
    params.append("category", String(categoryId));
  }

  if (filters.specialtyTagId !== null) {
    params.set("specialty_tag", String(filters.specialtyTagId));
  }

  if (filters.hiddenGems) {
    params.set("hidden_gems", "true");
  }

  if (filters.openNow) {
    params.set("open_now", "true");
  }

  if (filters.businessId !== undefined) {
    params.set("business", String(filters.businessId));
  }

  return request(
    apiClient.get("/explorer/explore/map/", {
      params,
      signal,
    }),
  );
}
