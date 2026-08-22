import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import { ApiResponse } from "@/shared/types/apiResponse.types";

import type { ExploreBusinessListResponse } from "../types/exploreBusiness.types";

export async function getNewBusinesses(): Promise<
  ApiResponse<ExploreBusinessListResponse>
> {
  return request(apiClient.get("/explorer/explore/new-businesses/"));
}
