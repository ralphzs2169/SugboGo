import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { reconnectRecentExplore } from "../services/recentExploreReconnect.service";

/** Revalidates credentials on reconnect without promoting a local grant to authentication. */
export default function RecentExploreReconnect() {
  const grant = useOfflineAccessStore((state) => state.recentExplore);
  useEffect(() => {
    let wasOnline = onlineManager.isOnline();
    let wasFocused = focusManager.isFocused();
    const stopOnline = onlineManager.subscribe((online) => {
      if (online === wasOnline) return;
      wasOnline = online;
      if (online) void reconnectRecentExplore(true);
    });
    const stopFocus = focusManager.subscribe((focused) => {
      // Native listener re-registration can emit the same effective focus.
      if (focused === wasFocused) return;
      wasFocused = focused;
      if (focused) {
        void reconnectRecentExplore(true);
      }
    });
    void reconnectRecentExplore();
    return () => {
      stopOnline();
      stopFocus();
    };
  }, [grant]);
  return null;
}
