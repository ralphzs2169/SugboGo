import { useState } from "react";

import { forgotPassword } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/types/apiResponse.types";

/**
 * Hook for handling password reset email resend requests.
 *
 * Sends a password reset email request and returns the API response
 * for the screen to handle UI feedback and errors.
 */
export function useResendResetLink() {
  const [loading, setLoading] = useState(false);

  const handleResendPasswordReset = async (
    email: string,
  ): Promise<ApiMessageResponse> => {
    setLoading(true);

    try {
      return await forgotPassword({
        email,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    handleResendPasswordReset,
    loading,
  };
}
