import { useState, useCallback } from "react";
import axios from "axios";

import { validateResetToken } from "../api/auth.service";

/**
 * Custom hook for validating reset password tokens.
 * Provides a function to validate the token and manage loading state.
 */
export function useValidateResetToken() {
  const [loading, setLoading] = useState(false);

  const handleValidateResetToken = useCallback(async (payload) => {
    setLoading(true);

    try {
      return await validateResetToken(payload);
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
  }, []);

  return {
    handleValidateResetToken,
    loading,
  };
}
