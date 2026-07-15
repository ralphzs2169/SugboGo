import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuthStore } from "../store/auth.store";

/**
 * Protects routes that require authentication.
 *
 * Redirects unauthenticated users to the login screen
 * after session restoration completes.
 */
export function useAuthGuard() {
  const router = useRouter();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading]);
}
