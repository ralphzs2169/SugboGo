import { useState } from "react";

import { resendVerification } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/api/types";

/**
 * Hook for handling email verification resend requests.
 *
 * Manages the resend verification request lifecycle
 * and returns the API response for the screen to handle
 * user feedback and navigation.
 */
export function useResendVerification() {
  const [loading, setLoading] = useState(false);

  const handleResendVerification = async (
    email: string,
  ): Promise<ApiMessageResponse> => {
    setLoading(true);

    try {
      return await resendVerification(email);
    } finally {
      setLoading(false);
    }
  };

  return {
    handleResendVerification,
    loading,
  };
}
