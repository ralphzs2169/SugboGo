import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { BusinessChangePendingStatus } from "../types/businessChangePendingStatus.types";

export function getBusinessChangePendingStatus(): Promise<
  ApiResponse<BusinessChangePendingStatus>
> {
  return request(
    apiClient.get("/merchant/business-profile/update-requests/pending-status/"),
  );
}
