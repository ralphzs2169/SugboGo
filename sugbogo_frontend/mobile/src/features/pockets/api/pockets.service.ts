import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { PocketCollectionListResponse } from "../types/pockets.types";

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
