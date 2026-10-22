import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { restoreSession } from "@/features/auth/services/restoreSession.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";

/** Revalidates credentials on reconnect without promoting a local grant to authentication. */
export default function RecentExploreReconnect() {
  const grant = useOfflineAccessStore((state) => state.recentExplore);
  const busy = useRef(false);
  const attempted = useRef(false);
  useEffect(() => {
    async function validate() {
      if (
        !useOfflineAccessStore.getState().recentExplore ||
        busy.current ||
        attempted.current ||
        !onlineManager.isOnline()
      )
        return;
      attempted.current = true;
      busy.current = true;
      try {
        const result = await restoreSession();
        if (
          result === "authenticated" &&
          useAuthStore.getState().isAuthenticated
        )
          router.replace("/");
        else if (
          result === "denied" &&
          !useAuthStore.getState().isAuthenticated
        )
          router.replace("/(auth)/login");
      } catch {
        // Storage/session cleanup failures must not promote local authority.
      } finally {
        busy.current = false;
      }
    }
    const stopOnline = onlineManager.subscribe((online) => {
      if (!online) attempted.current = false;
      else void validate();
    });
    const stopFocus = focusManager.subscribe((focused) => {
      if (focused) {
        attempted.current = false;
        void validate();
      }
    });
    void validate();
    return () => {
      stopOnline();
      stopFocus();
    };
  }, [grant]);
  return null;
}
