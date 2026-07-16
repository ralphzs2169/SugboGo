import { useState } from "react";
import axios from "axios";

import { resendVerification } from "../api/auth.service";

/**
 * Custom hook for handling email verification resending.
 */
export function useResendVerification() {
  const [loading, setLoading] = useState(false);

  const handleResend = async (email: string) => {
    setLoading(true);

    try {
      const response = await resendVerification(email);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data,
        };
      }

      return {
        success: false,
        error: {
          detail: "Something went wrong. Please try again.",
        },
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
