import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import {
  assertAuthSessionCurrent,
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { deactivateAccount } from "../api/auth.service";
import type { DeactivateAccountRequest } from "../types/auth.types";
import { useLogout } from "./useLogout";

/** Clears the originating local session only after confirmed server deactivation. */
export function useDeactivateAccount() {
  const { logout } = useLogout();

  return useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (payload: DeactivateAccountRequest) => {
      const generation = getAuthSessionGeneration();
      const response = await deactivateAccount(payload);
      assertAuthSessionCurrent(generation);
      throwOnApiError(response);

      const cleanup = logout();
      const cleanupGeneration = getAuthSessionGeneration();
      await cleanup;
      if (!isAuthSessionGenerationCurrent(cleanupGeneration)) return;
      router.replace("/(auth)/login");
      Toast.show({
        type: "success",
        text1: "Account deactivated",
        text2: "Contact support to request reactivation.",
      });
    },
  });
}
