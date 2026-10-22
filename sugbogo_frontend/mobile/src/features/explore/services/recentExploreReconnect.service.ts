import { onlineManager } from "@tanstack/react-query";
import { router } from "expo-router";

import { restoreSession } from "@/features/auth/services/restoreSession.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { subscribeAuthSessionChanges } from "@/shared/api/authSessionGeneration.service";

let active = false;
let attempted: { ownerId: number; apiScope: string } | null = null;

subscribeAuthSessionChanges((change) => {
  if (change === "replace" || change === "revoke") {
    attempted = null;
  }
});

/** Owns reconnect attempts across generation-keyed provider and component remounts. */
export async function reconnectRecentExplore(retry = false) {
  const grant = useOfflineAccessStore.getState().recentExplore;
  if (!grant || active || !onlineManager.isOnline()) {
    return;
  }
  if (
    !retry &&
    attempted?.ownerId === grant.ownerId &&
    attempted.apiScope === grant.apiScope
  ) {
    return;
  }

  // Restore/offline generation changes belong to this recovery lifecycle.
  // Only a later connectivity/focus event retries a completed transport failure.
  attempted = { ownerId: grant.ownerId, apiScope: grant.apiScope };
  active = true;
  try {
    const result = await restoreSession();
    if (result === "authenticated" && useAuthStore.getState().isAuthenticated) {
      router.replace("/");
    } else if (
      result === "denied" &&
      !useAuthStore.getState().isAuthenticated
    ) {
      router.replace("/(auth)/login");
    }
  } catch {
    // Storage/session cleanup failures must not promote local authority.
  } finally {
    active = false;
  }
}
