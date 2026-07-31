import { useState } from "react";

import { register } from "../api/auth.service";
import { AuthResponse } from "../types/auth.types";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import { useVerificationStore } from "../store/verification.store";

/**
 * Hook for handling user registration.
 *
 * Manages the registration request lifecycle and stores the
 * email for the verification flow after successful account creation.
 */
export function useRegister() {
  const [loading, setLoading] = useState(false);

  const setPendingEmail = useVerificationStore(
    (state) => state.setPendingEmail,
  );

  const handleRegister = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<ApiResponse<AuthResponse>> => {
    setLoading(true);

    try {
      const response = await register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });

      if (response.success) {
        setPendingEmail(email);
      }

      return response;
    } finally {
      setLoading(false);
    }
  };

  return {
    handleRegister,
    loading,
  };
}
