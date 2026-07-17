import { useState } from "react";
import axios from "axios";

import { resendVerification } from "../api/auth.service";
import { ApiResult } from "@/shared/api/types";

/**
 * Custom hook for resending email verification.
 */
export function useResendVerification() {
  const [loading, setLoading] = useState(false);

  const handleResend = async (email: string): Promise<ApiResult<void>> => {
    setLoading(true);

    try {
      const response = await resendVerification(email);

      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: "Something went wrong. Please try again.",
        code: "UNKNOWN_ERROR",
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    handleResend,
    loading,
  };
}
