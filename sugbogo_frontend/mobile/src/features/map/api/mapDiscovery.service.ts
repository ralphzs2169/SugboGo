import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { MapDiscoveryResponse } from "../types/mapDiscovery.types";

/** Retrieves one compact global directory page, independently of the camera. */
export async function getMapDirectoryPage(
  page: number,
  signal?: AbortSignal,
  options: { openNow?: boolean; businessId?: number } = {},
): Promise<ApiResponse<MapDiscoveryResponse>> {
  const params = new URLSearchParams({ page: String(page), page_size: "200" });
  if (options.openNow) {
    params.set("open_now", "true");
  }
  if (options.businessId !== undefined) {
    params.set("business", String(options.businessId));
  }
  return request(
    apiClient.get("/explorer/explore/map/businesses/", { params, signal }),
  );
}
