import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import {
  assertAuthSessionCurrent,
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { changePassword } from "../api/auth.service";
import type { ChangePasswordRequest } from "../types/auth.types";
import { useLogout } from "./useLogout";

/** Changes a password and clears the originating session before fresh sign-in. */
export function useChangePassword() {
  const { logout } = useLogout();

  return useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (payload: ChangePasswordRequest) => {
      const generation = getAuthSessionGeneration();
      const response = await changePassword(payload);
      assertAuthSessionCurrent(generation);
      throwOnApiError(response);

      const cleanup = logout();
      const cleanupGeneration = getAuthSessionGeneration();
      await cleanup;
      if (!isAuthSessionGenerationCurrent(cleanupGeneration)) return;
      router.replace("/(auth)/login");
      Toast.show({
        type: "success",
        text1: "Password changed",
        text2: "Sign in again with your new password.",
      });
    },
  });
}
