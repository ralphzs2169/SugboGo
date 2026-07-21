import { useState } from "react";
import axios from "axios";

import { resetPassword } from "../api/auth.service";

/**
 * Custom hook for handling password reset functionality.
 * Provides a function to perform password reset and manage loading state.
 */
export function useResetPassword() {
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (payload) => {
    setLoading(true);

    try {
      return await resetPassword(payload);
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
    handleResetPassword,
    loading,
  };
}
