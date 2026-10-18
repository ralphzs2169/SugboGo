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
  });

  return (method: NavigationMethod) => {
    const user = useAuthStore.getState().user;
    if (
      !user ||
      user.status !== "active" ||
      isOwnBusiness ||
      !Number.isInteger(businessId) ||
      businessId <= 0
    )
      return;
    // No identity is invented for guest navigation, and nothing is queued offline.
    mutate(method);
  };
}
