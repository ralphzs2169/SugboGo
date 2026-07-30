import { useCallback, useState } from "react";

import { verifyEmail } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/types/apiResponse.types";

/**
 * Hook for handling email verification.
 *
 * Manages the verification request lifecycle and provides
 * a stable function for triggering the verification API request.
 */
export function useVerifyEmail() {
  const [loading, setLoading] = useState(false);

  const handleVerifyEmail = useCallback(
    async (uid: string, token: string): Promise<ApiMessageResponse> => {
      setLoading(true);

      try {
        return await verifyEmail(uid, token);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    handleVerifyEmail,
    loading,
  };
}
