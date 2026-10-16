import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { clearTokens } from "@/shared/api/storage.service";

import { notificationWebSocketService } from "../services/notificationWebSocket.service";
import { notificationKeys } from "./notificationQueryKeys";

function hasUsableConnection(
  state: Pick<
    Awaited<ReturnType<typeof NetInfo.fetch>>,
    "isConnected" | "isInternetReachable"
  >,
) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Binds the account-level notification socket to authentication, connectivity,
 * application state, and the account-scoped React Query cache.
 */
export function useNotificationWebSocketLifecycle() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;

    notificationWebSocketService.setAppActive(
      AppState.currentState === "active",
    );

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        notificationWebSocketService.setAppActive(nextState === "active");
      },
    );

    const networkSubscription = NetInfo.addEventListener((state) => {
      notificationWebSocketService.setOnline(hasUsableConnection(state));
    });

    void NetInfo.fetch().then((state) => {
      if (!disposed) {
        notificationWebSocketService.setOnline(hasUsableConnection(state));
      }
    });

    return () => {
      disposed = true;
      appStateSubscription.remove();
      networkSubscription();
      notificationWebSocketService.stop();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      notificationWebSocketService.stop();
      return;
    }

    notificationWebSocketService.start({
      userId,
      onSyncRequired: () => {
        void queryClient.invalidateQueries({
          queryKey: notificationKeys.account(userId),
          refetchType: "active",
        });
      },
      onSessionExpired: async () => {
        const currentUserId = useAuthStore.getState().user?.id;

        if (currentUserId !== userId) {
          return;
        }

        await clearTokens();
        queryClient.clear();
        useAuthStore.getState().clearUser();
        useAuthStore.getState().setSessionExpired(true);
        router.replace("/(auth)/login");
      },
    });

    return () => {
      notificationWebSocketService.stop();
    };
  }, [isAuthenticated, queryClient, userId]);
}
