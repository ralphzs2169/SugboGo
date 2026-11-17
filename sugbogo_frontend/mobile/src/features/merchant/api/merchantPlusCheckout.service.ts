import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { MerchantPlusCheckout } from "../types/merchantPlusCheckout.types";
import type { MerchantPlusStatus } from "../types/merchantPlusAnalytics.types";

/** Requests server-priced checkout, optionally retrying a server-identified attempt. */
export function createMerchantPlusCheckout(
  signal?: AbortSignal,
  retryCheckoutReference?: string,
): Promise<ApiResponse<MerchantPlusCheckout>> {
  const body = retryCheckoutReference
    ? { retry_checkout_reference: retryCheckoutReference }
    : {};
  return request(apiClient.post("/merchant/plus/checkout/", body, { signal }));
}

/** Requests independent backend verification of the current owned purchase. */
export function reconcileMerchantPlusPayment(
  signal?: AbortSignal,
): Promise<ApiResponse<MerchantPlusStatus>> {
  return request(
    apiClient.post("/merchant/plus/payment/reconcile/", {}, { signal }),
  );
}
