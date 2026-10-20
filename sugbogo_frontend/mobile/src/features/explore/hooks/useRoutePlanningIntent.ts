import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { recordRoutePlanningIntent } from "../api/routePlanningIntent.service";
import type { NavigationMethod } from "../types/routePlanningIntent.types";

/** Returns an action-only observer; failed tracking never blocks or retries guidance. */
export default function useRoutePlanningIntent(
  businessId: number,
  isOwnBusiness: boolean,
) {
  const { mutate } = useMutation({
    mutationFn: async (method: NavigationMethod) =>
      throwOnApiError(await recordRoutePlanningIntent(businessId, method)),
    retry: false,
    networkMode: "always",
    throwOnError: false,
    onSuccess: (result, method) => {
      if (__DEV__) {
        console.debug("[route-intent] result", {
          method,
          recorded: result.recorded,
          duplicate: result.duplicate,
          ownerExcluded: result.excluded_reason === "business_owner",
        });
      }
    },
    onError: (error: unknown, method) => {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;
      if (__DEV__) {
        console.warn("[route-intent] submission failed", {
          method,
          code:
            typeof code === "string" && /^[A-Z_]{1,64}$/.test(code)
              ? code
              : "UNKNOWN_ERROR",
        });
      }
    },
  });

  return (method: NavigationMethod) => {
    const user = useAuthStore.getState().user;
    let excludedReason: string | undefined;
    if (!user) excludedReason = "guest";
    else if (user.status !== "active") excludedReason = "inactive_account";
    else if (isOwnBusiness) excludedReason = "business_owner";
    else if (!Number.isInteger(businessId) || businessId <= 0)
      excludedReason = "invalid_business";
    if (excludedReason) {
      if (__DEV__) {
        console.debug("[route-intent] skipped", { reason: excludedReason });
      }
      return;
    }
    // No identity is invented for guest navigation, and nothing is queued offline.
    if (__DEV__) console.debug("[route-intent] submitting", { method });
    mutate(method);
  };
}
