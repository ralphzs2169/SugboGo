import { clearTokens } from "@/shared/api/storage";
import { useAuthStore } from "../store/auth.store";

/**
 * Handles user logout.
 *
 * Removes stored authentication tokens and resets the global
 * authentication state.
 */
export function useLogout() {
  const clearUser = useAuthStore((state) => state.clearUser);

  async function logout() {
    try {
      await clearTokens();

      clearUser();
    } catch (error) {
      console.log("Logout failed:", error);
    }
  }

  return {
    logout,
  };
}
