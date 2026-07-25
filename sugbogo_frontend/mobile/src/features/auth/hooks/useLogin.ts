import { useState } from "react";

import { login } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import { AuthResponse } from "../types/auth.types";
import { useVerificationStore } from "../store/verification.store";
import { ApiResponse } from "@/shared/api/types";

/**
 * Custom hook that handles user login.
 *
 * Authenticates the user, establishes the application session,
 * manages the login request lifecycle, and clears pending
 * verification state after successful login.
 */
export function useLogin() {
  const [loading, setLoading] = useState(false);

  const clearPendingEmail = useVerificationStore(
    (state) => state.clearPendingEmail,
  );

  const handleLogin = async (
    email: string,
    password: string,
  ): Promise<ApiResponse<AuthResponse>> => {
    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  };

  return {
    handleLogin,
    loading,
  };
}
