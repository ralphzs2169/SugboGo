import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Toast from "react-native-toast-message";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";
import { merchantApplicationKeys } from "@/features/merchant/hooks/merchantApplicationQueryKeys";
import { getProfile } from "@/features/profile/api/profile.service";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

/** Resolves the owner's first-time Merchant setup before opening business management. */
export default function useOpenBusinessManagement() {
  const queryClient = useQueryClient();
  const focus = useRef<{ opening: boolean } | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  useFocusEffect(
    useCallback(() => {
      focus.current = { opening: false };
      setIsOpening(false);

      return () => {
        focus.current = null;
      };
    }, []),
  );

  async function openBusinessManagement() {
    const currentFocus = focus.current;
    const { user, isAuthenticated } = useAuthStore.getState();
    if (
      !currentFocus ||
      currentFocus.opening ||
      !isAuthenticated ||
      !user
    ) {
      return;
    }

    const generation = getAuthSessionGeneration();
    const isCurrent = () =>
      focus.current === currentFocus &&
      isAuthSessionCurrent(generation) &&
      useAuthStore.getState().user?.id === user.id;

    currentFocus.opening = true;
    setIsOpening(true);

    try {
      const status = await queryClient.fetchQuery({
        queryKey: merchantApplicationKeys.status(user.id),
        queryFn: async () => throwOnApiError(await getApplicationStatus()),
        staleTime: 0,
        networkMode: "always",
        retry: false,
      });

      if (!isCurrent()) {
        return;
      }

      if (
        status?.status === "approved" &&
        !status.merchant_mode_acknowledged
      ) {
        router.push({
          pathname: "/(explorer)/profile/merchant-portal",
          params: { continueTo: "business-profile" },
        });
        return;
      }

      if (useAuthStore.getState().user?.role !== "merchant") {
        const profile = throwOnApiError(await getProfile());
        if (!isCurrent() || profile.id !== user.id) {
          return;
        }
        useAuthStore.getState().setUser(profile);
      }

      if (useAuthStore.getState().user?.role !== "merchant") {
        Toast.show({
          type: "error",
          text1: "Merchant access unavailable",
          text2: "An active Merchant account is required to manage this business.",
        });
        return;
      }

      useAppModeStore.getState().setActiveMode("merchant");
      router.replace("/(merchant)/(tabs)/profile");
    } catch (error) {
      if (!isCurrent()) {
        return;
      }

      const response = error as ApiResponse<unknown> | undefined;
      if (response?.success === false && handleSystemError(response)) {
        return;
      }

      Toast.show({
        type: "error",
        text1: "Unable to open business management",
        text2: "Please try again.",
      });
    } finally {
      if (focus.current === currentFocus) {
        currentFocus.opening = false;
        setIsOpening(false);
      }
    }
  }

  return { isOpening, openBusinessManagement };
}
