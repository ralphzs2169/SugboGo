import { login } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import { AuthResponse } from "../api/auth.types";
import { useVerificationStore } from "../store/verification.store";
import { ApiResponse } from "@/shared/api/types";

/**
 * Custom hook for handling user login.
 */
export function useLogin() {
  const clearPendingEmail = useVerificationStore(
    (state) => state.clearPendingEmail,
  );

  const handleLogin = async (
    email: string,
    password: string,
  ): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await login({
        email,
        password,
      });

      if (!response.success) {
        return response;
      }

      await establishSession(response.data);

      clearPendingEmail();

      return response;
    } catch (error) {
      console.error("Unexpected login error:", error);

      return {
        success: false,
        message: "Something unexpected happened. Please try again.",
        code: "UNKNOWN_ERROR",
      };
    }
  };

  return {
    handleLogin,
  };
}
