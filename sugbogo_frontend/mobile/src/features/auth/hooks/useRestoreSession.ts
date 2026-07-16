import { useEffect, useRef } from "react";

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
  const hasRestored = useRef(false);

  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (hasRestored.current) return;

    hasRestored.current = true;

    async function restoreSession() {
      try {
        console.log("🔄 Restoring session...");

        const token = await getAccessToken();

        console.log("🔑 Token:", token);

        if (!token) {
          console.log("❌ No token found");
          clearUser();
          return;
        }

        const user = await getCurrentUser();

        console.log("👤 User restored:", user);

        setUser(user);
      } catch (error) {
        console.log("❌ Session restore failed:", error);

        await clearTokens();
        clearUser();
      } finally {
        setLoading(false);
        console.log("✅ Auth loading finished");
      }
    }

    restoreSession();
  }, [clearUser, setLoading, setUser]);
}
