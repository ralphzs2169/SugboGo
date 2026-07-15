import { useEffect } from "react";

import { getCurrentUser } from "../api/auth.service";
import { getAccessToken, clearTokens } from "@/shared/api/storage";
import { useAuthStore } from "../store/auth.store";

/**
 * Restores the user's authentication session when the application starts.
 *
 * Checks for an existing access token in secure storage, validates the token
 * by fetching the current user, and updates the global authentication state.
 */
export function useRestoreSession() {
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getAccessToken();

        if (!token) {
          clearUser();
          return;
        }

        const user = await getCurrentUser();

        setUser(user);
      } catch (error) {
        console.log("Session restore failed:", error);

        await clearTokens();
        clearUser();
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);
}
