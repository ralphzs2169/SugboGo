import { useEffect } from "react";

import { getCurrentUser } from "../api/auth.service";
import {
  getAccessToken,
  getSessionGeneration,
  clearTokens,
  subscribeToSessionChanges,
} from "@/shared/api/storage";
import { useAuthStore } from "../storage/auth.store";

/**
 * Restore the current owner on mount and external session changes, rejecting obsolete reads.
 */
export function useRestoreSession() {
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    let controller;

    async function restoreSession() {
      controller?.abort();
      const currentController = new AbortController();
      controller = currentController;
      const generation = getSessionGeneration();
      const isCurrent = () => (
        !currentController.signal.aborted && generation === getSessionGeneration()
      );
      try {
        const token = getAccessToken();

        if (!token) {
          clearUser();
          return;
        }

        setLoading(true);
        const user = await getCurrentUser({ signal: currentController.signal });

        if (isCurrent()) setUser(user);
      } catch {
        if (isCurrent()) {
          clearTokens();
          clearUser();
          setLoading(false);
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    const unsubscribe = subscribeToSessionChanges(restoreSession);
    restoreSession();
    return () => {
      unsubscribe();
      controller?.abort();
    };
  }, [clearUser, setLoading, setUser]);
}
