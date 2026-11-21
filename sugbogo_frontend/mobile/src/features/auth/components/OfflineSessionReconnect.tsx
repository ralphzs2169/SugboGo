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

const RECONNECT_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

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
    let disposed = false;
    let retryIndex = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function cancelRetry() {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }

    function queueReconnect(delay: number) {
      const generation = getAuthSessionGeneration();
      cancelRetry();
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (isOfflineTransportSession(generation)) {
          void reconnect();
        }
      }, Math.min(delay, MAX_TIMER_DELAY_MS));
    }

    function scheduleRetry() {
      const delay = RECONNECT_RETRY_DELAYS_MS[retryIndex];
      if (
        delay === undefined ||
        !onlineManager.isOnline() ||
        !focusManager.isFocused()
      ) {
        return;
      }

      const retryAfter = useOfflineAccessStore.getState().retrySessionAfter;
      retryIndex += 1;
      queueReconnect(Math.max(delay, (retryAfter ?? 0) - Date.now()));
    }

    async function reconnect() {
      const auth = useAuthStore.getState();
      if (
        disposed ||
        reconnecting ||
        auth.isLoading ||
        auth.isSigningIn ||
        auth.isAuthenticated ||
        !onlineManager.isOnline() ||
        !focusManager.isFocused() ||
        !isOfflineTransportSession(getAuthSessionGeneration())
      ) {
        return;
      }

      const retryAfter = useOfflineAccessStore.getState().retrySessionAfter;
      const remaining = (retryAfter ?? 0) - Date.now();
      if (remaining > 0) {
        queueReconnect(remaining);
        return;
      }

      reconnecting = true;
      try {
        const grant = useOfflineAccessStore.getState().recentExplore;
        const cachedOwnerId =
          grant && isRecentExploreCurrent(grant) ? grant.ownerId : null;
        const result = await restoreSession();
        if (disposed) return;

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
          } else if (result === "offline") {
            scheduleRetry();
          }
        }
      } catch {
        if (!disposed && !useAuthStore.getState().isAuthenticated) {
          onRecoveryRequired();
        }
      } finally {
        reconnecting = false;
      }
    }

    const stopOnline = onlineManager.subscribe((online) => {
      if (online === wasOnline) return;
      wasOnline = online;
      cancelRetry();
      retryIndex = 0;
      if (online) void reconnect();
    });
    const stopFocus = focusManager.subscribe((focused) => {
      // Native listener re-registration can emit the same effective focus.
      if (focused === wasFocused) return;
      wasFocused = focused;
      cancelRetry();
      retryIndex = 0;
      if (focused) {
        void reconnect();
      }
    });
    // Connectivity may have returned while startup was checking local data.
    void reconnect();
    return () => {
      disposed = true;
      cancelRetry();
      stopOnline();
      stopFocus();
    };
  }, [onRecoveryRequired]);
  return null;
}
