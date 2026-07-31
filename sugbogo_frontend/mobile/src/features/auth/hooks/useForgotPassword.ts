import { forgotPassword } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/types/apiResponse.types";
import { useState } from "react";
/**
 * Hook for handling forgot password requests.
 *
 * Sends the password reset request and returns the API response
 * for the screen to handle navigation and error presentation.
 */
export function useForgotPassword() {
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (
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
    handleForgotPassword,
    loading,
  };
}
