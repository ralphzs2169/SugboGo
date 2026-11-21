import { focusManager, onlineManager } from "@tanstack/react-query";
import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import {
  getAuthSessionGeneration,
  isOfflineTransportSession,
} from "@/shared/api/authSessionGeneration.service";
import {
  isRecentExploreCurrent,
  useOfflineAccessStore,
} from "@/features/offline-routes/stores/offlineAccess.store";

import { restoreSession } from "../services/restoreSession.service";
import { useAuthStore } from "../store/auth.store";

let reconnecting = false;

/** Revalidates suspended credentials when the app regains connectivity or focus. */
export default function OfflineSessionReconnect({
  onRecoveryRequired,
}: {
  onRecoveryRequired: () => void;
}) {
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let wasOnline = onlineManager.isOnline();
    let wasFocused = focusManager.isFocused();

    async function reconnect() {
      const auth = useAuthStore.getState();
      if (
        reconnecting ||
        auth.isLoading ||
        auth.isSigningIn ||
        auth.isAuthenticated ||
        !onlineManager.isOnline() ||
        !isOfflineTransportSession(getAuthSessionGeneration())
      ) {
        return;
      }

      reconnecting = true;
      try {
        const grant = useOfflineAccessStore.getState().recentExplore;
        const cachedOwnerId =
          grant && isRecentExploreCurrent(grant) ? grant.ownerId : null;
        const result = await restoreSession();
        const current = useAuthStore.getState();
        if (result === "authenticated" && current.isAuthenticated) {
          if (
            currentPath.current !== "/explore" ||
            !current.user?.has_completed_interest_selection ||
            (cachedOwnerId !== null && current.user.id !== cachedOwnerId)
          ) {
            router.replace("/");
          }
        } else if (!current.isAuthenticated && !current.isSigningIn) {
          if (result === "denied") {
            // The Explore layout handles access withdrawal on its own route.
            if (currentPath.current !== "/explore") {
              router.replace("/(auth)/login");
            }
          } else if (result === "recovery") {
            onRecoveryRequired();
          }
        }
      } catch {
        if (!useAuthStore.getState().isAuthenticated) {
          onRecoveryRequired();
        }
      } finally {
        reconnecting = false;
      }
    }

    const stopOnline = onlineManager.subscribe((online) => {
      if (online === wasOnline) return;
      wasOnline = online;
      if (online) void reconnect();
    });
    const stopFocus = focusManager.subscribe((focused) => {
      // Native listener re-registration can emit the same effective focus.
      if (focused === wasFocused) return;
      wasFocused = focused;
      if (focused) {
        void reconnect();
      }
    });
    // Connectivity may have returned while startup was checking local data.
    void reconnect();
    return () => {
      stopOnline();
      stopFocus();
    };
  }, [onRecoveryRequired]);
  return null;
}
