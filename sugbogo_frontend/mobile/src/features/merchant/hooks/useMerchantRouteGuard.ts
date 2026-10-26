import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";

/** Hides invalid Merchant routes while preserving the existing session redirect. */
export default function useMerchantRouteGuard() {
  useAuthGuard();
  const router = useRouter();
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);
  const resolving = isLoading || (isAuthenticated && !user);

  useEffect(() => {
    if (resolving || !isAuthenticated || !user || user.role === "merchant")
      return;
    setActiveMode("explorer");
    router.replace("/(explorer)/(tabs)/explore");
  }, [resolving, isAuthenticated, user, router, setActiveMode]);

  return {
    resolving,
    allowed: !resolving && isAuthenticated && user?.role === "merchant",
  };
}
