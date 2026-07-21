import { useState } from "react";

import { register } from "../api/auth.service";
import { AuthResponse } from "../api/auth.types";
import { ApiResponse } from "@/shared/api/types";
import { useVerificationStore } from "../store/verification.store";

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
