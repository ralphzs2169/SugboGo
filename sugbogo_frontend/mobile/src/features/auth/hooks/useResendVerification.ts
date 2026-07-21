import { useState } from "react";

import { resendVerification } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/api/types";

/**
 * Custom hook for resending email verification.
 */
export function useResendVerification() {
  const [loading, setLoading] = useState(false);

  const handleResend = async (email: string): Promise<ApiMessageResponse> => {
    setLoading(true);

    try {
      return await resendVerification(email);
    } finally {
      setLoading(false);
    }
  };

  return {
    handleResend,
    loading,
  };
}
