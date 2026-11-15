import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { MerchantPlusCheckout } from "../types/merchantPlusCheckout.types";
import type { MerchantPlusStatus } from "../types/merchantPlusAnalytics.types";

/** Requests server-priced checkout with no client purchase overrides or automatic retry. */
export function createMerchantPlusCheckout(
  signal?: AbortSignal,
): Promise<ApiResponse<MerchantPlusCheckout>> {
  return request(apiClient.post("/merchant/plus/checkout/", {}, { signal }));
}

/** Requests independent backend verification of the current owned purchase. */
export function reconcileMerchantPlusPayment(
  signal?: AbortSignal,
): Promise<ApiResponse<MerchantPlusStatus>> {
  return request(
    apiClient.post("/merchant/plus/payment/reconcile/", {}, { signal }),
  );
}
