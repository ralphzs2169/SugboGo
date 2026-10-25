import { useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { recentBusinessDetails } from "../services/recentBusinessDetails.service";
import { resolveBusinessProfilePreview } from "../utils/businessProfilePreview";

function subscribeSession(notify: () => void) {
  return subscribeAuthSessionChanges(() => notify());
}

/** A read-only, route-local identity snapshot; never creates or updates a detail query. */
export default function useBusinessProfilePreview(
  businessId: number,
  enabled: boolean,
) {
  const client = useQueryClient();
  useAuthStore((state) => state.user?.id);
  useAuthStore((state) => state.isAuthenticated);
  useAuthStore((state) => state.isLoading);
  useSyncExternalStore(
    subscribeSession,
    getAuthSessionGeneration,
    getAuthSessionGeneration,
  );
  // Revoke a mounted preview on session/scope changes, rather than carrying it
  // into a replacement account. A new route opening may resolve a new preview.
  const session = useMemo(
    () => recentBusinessDetails.capture(),
    [businessId, client],
  );
  const preview = useMemo(
    () =>
      enabled && session.isAuthorized() && session.ownerId != null
        ? resolveBusinessProfilePreview(client, businessId, session.ownerId)
        : null,
    [businessId, client, enabled, session],
  );
  return enabled && session.isAuthorized() ? preview : null;
}
