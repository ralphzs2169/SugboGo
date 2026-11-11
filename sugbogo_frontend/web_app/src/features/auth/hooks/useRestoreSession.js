import { useEffect } from "react";
import axios from "axios";

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
    let retryRestore = false;

    async function restoreSession() {
      retryRestore = false;
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
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        if (
          axios.isCancel(error) ||
          error.name === "STALE_AUTH_SESSION"
        ) {
          return;
        }

        // A failed transport or temporary backend failure does not revoke a session.
        if (error.response?.status === 401) {
          clearTokens();
        } else {
          retryRestore = true;
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    function retryRestoration() {
      if (retryRestore) {
        void restoreSession();
      }
    }

    const unsubscribe = subscribeToSessionChanges(restoreSession);
    window.addEventListener("online", retryRestoration);
    window.addEventListener("focus", retryRestoration);
    restoreSession();
    return () => {
      unsubscribe();
      window.removeEventListener("online", retryRestoration);
      window.removeEventListener("focus", retryRestoration);
      controller?.abort();
    };
  }, [clearUser, setLoading, setUser]);
}
