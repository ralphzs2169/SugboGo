import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import Toast from "react-native-toast-message";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";
import { merchantApplicationKeys } from "@/features/merchant/hooks/merchantApplicationQueryKeys";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import type { NotificationItem } from "../types/notification.types";
import {
  resolveNotificationDestination,
  type NotificationDestination,
} from "../utils/notificationDestination";

type Options = {
  markRead: (notificationId: number) => Promise<unknown>;
};

type ReadResult = "success" | "failed" | "session-ended";

function showError(error: unknown, title: string, fallback: string) {
  const response = error as Partial<ApiResponse<unknown>> | null;

  if (
    response?.success === false &&
    handleSystemError(response as ApiResponse<unknown>)
  ) {
    return;
  }

  Toast.show({
    type: "error",
    text1: title,
    text2:
      response?.success === false && response.message
        ? response.message
        : fallback,
  });
}

/**
 * Coordinates read state, Merchant eligibility, mode transitions, and routing
 * for notification presses while suppressing duplicate navigation attempts.
 */
export function useNotificationNavigation({ markRead }: Options) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const activeMode = useAppModeStore((state) => state.activeMode);
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);
  const handlingRef = useRef(false);
  const mountedRef = useRef(true);
  const [pendingNotificationId, setPendingNotificationId] = useState<
    number | null
  >(null);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      handlingRef.current = false;
      setPendingNotificationId(null);
    }, []),
  );

  async function markUnreadNotification(
    notification: NotificationItem,
  ): Promise<ReadResult> {
    if (notification.is_read) {
      return "success";
    }

    try {
      await markRead(notification.id);
      return "success";
    } catch (error) {
      const response = error as Partial<ApiResponse<unknown>> | null;
      const sessionEnded =
        response?.success === false &&
        (response.code === "SESSION_EXPIRED" ||
          !useAuthStore.getState().isAuthenticated);

      showError(
        error,
        "Couldn't mark notification as read",
        "You can still open the notification and try again later.",
      );

      return sessionEnded ? "session-ended" : "failed";
    }
  }

  async function canOpenMerchantDestination() {
    if (user?.role !== "merchant") {
      Toast.show({
        type: "error",
        text1: "Merchant access unavailable",
        text2: "This destination requires an active Merchant account.",
      });
      return false;
    }

    if (activeMode === "merchant") {
      return true;
    }

    try {
      const status = await queryClient.fetchQuery({
        queryKey: merchantApplicationKeys.status(user.id),
        queryFn: async () => throwOnApiError(await getApplicationStatus()),
        staleTime: 60_000,
      });

      if (status?.status !== "approved" || !status.merchant_mode_acknowledged) {
        Toast.show({
          type: "error",
          text1: "Merchant access unavailable",
          text2:
            "Finish setting up Merchant Mode from your profile before opening this update.",
        });
        return false;
      }

      return true;
    } catch (error) {
      showError(
        error,
        "Unable to verify Merchant access",
        "Please check your connection and try again.",
      );
      return false;
    }
  }

  function openDestination(destination: NotificationDestination) {
    if (destination.requiredMode === "merchant" && activeMode !== "merchant") {
      setActiveMode("merchant");
      router.replace(destination.href);
      Toast.show({ type: "info", text1: "Switched to Merchant Mode" });
      return;
    }

    router.push(destination.href);
  }

  async function handleNotificationPress(notification: NotificationItem) {
    if (handlingRef.current) {
      return;
    }

    handlingRef.current = true;
    setPendingNotificationId(notification.id);
    let didNavigate = false;

    try {
      const resolution = resolveNotificationDestination(notification);
      const accessPromise =
        resolution.kind === "destination"
          ? canOpenMerchantDestination()
          : Promise.resolve(false);
      const [canOpen, readResult] = await Promise.all([
        accessPromise,
        markUnreadNotification(notification),
      ]);

      if (readResult === "session-ended") {
        return;
      }

      if (resolution.kind === "unavailable") {
        Toast.show({
          type: "error",
          text1: "Destination unavailable",
          text2: "This notification no longer has a valid destination.",
        });
        return;
      }

      if (resolution.kind === "destination" && canOpen) {
        openDestination(resolution.destination);
        didNavigate = true;
      }
    } finally {
      if (!didNavigate) {
        handlingRef.current = false;

        if (mountedRef.current) {
          setPendingNotificationId(null);
        }
      }
    }
  }

  return {
    handleNotificationPress,
    pendingNotificationId,
    isHandlingNotification: pendingNotificationId !== null,
  };
}
