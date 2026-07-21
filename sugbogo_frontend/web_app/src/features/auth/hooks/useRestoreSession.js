import { useEffect, useRef } from "react";

import { getCurrentUser } from "../api/auth.service";
import { getAccessToken, clearTokens } from "@/shared/api/storage";
import { useAuthStore } from "../storage/auth.store";

/**
 * Custom hook to restore the user session on component mount.
 * It checks for an existing access token and fetches the current user if available.
 * If the session restoration fails, it clears the tokens and user state.
 */
export function useRestoreSession() {
  const hasRestored = useRef(false);

  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (hasRestored.current) return;

    hasRestored.current = true;

    async function restoreSession() {
      try {
        const token = getAccessToken();

        if (!token) {
          clearUser();
          return;
        }

        const user = await getCurrentUser();

        setUser(user);
      } catch (error) {
        console.log("Session restore failed:", error);

        clearTokens();
        clearUser();
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [clearUser, setLoading, setUser]);
}
