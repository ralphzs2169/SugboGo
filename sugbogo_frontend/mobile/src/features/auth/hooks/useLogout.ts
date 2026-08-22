import { useQueryClient } from "@tanstack/react-query";

import { clearTokens } from "@/shared/api/storage.service";
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
    try {
      await clearTokens();

      queryClient.clear();

      useMerchantRegistrationStore.getState().reset();

      return true;
    } catch (error) {
      console.error("Logout failed:", error);
      return false;
    } finally {
      clearUser();
    }
  }

  return {
    logout,
  };
}
