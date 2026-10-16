import { useQueryClient } from "@tanstack/react-query";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { invalidateAuthSession } from "@/shared/api/authSessionGeneration.service";
import { clearSessionTokens } from "@/shared/api/storage.service";
import { useAuthStore } from "../store/auth.store";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";

/**
 * Handles user logout.
 *
 * Removes stored authentication tokens, clears server-state cache,
 * and resets the global authentication state.
 */
export function useLogout() {
  const clearUser = useAuthStore((state) => state.clearUser);
  const queryClient = useQueryClient();

  async function logout() {
    const cleanupGeneration = invalidateAuthSession();

    clearUser();
    useAppModeStore.getState().resetActiveMode();
    queryClient.clear();
    useMerchantRegistrationStore.getState().reset();

    try {
      await clearSessionTokens(cleanupGeneration);

      return true;
    } catch (error) {
      console.error("Logout failed:", error);
      return false;
    }
  }

  return {
    logout,
  };
}
