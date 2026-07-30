import { resetPassword } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/types/apiResponse.types";
import { useState } from "react";
/**
 * Custom hook that handles password reset requests.
 *
 * Sends the reset password payload to the API and returns the standardized
 * API response for the screen to handle.
 */
export function useResetPassword() {
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (
    uid: string,
    token: string,
    password: string,
  ): Promise<ApiMessageResponse> => {
    setLoading(true);

    try {
      return await resetPassword({
        uid,
        token,
        password,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    handleResetPassword,
    loading,
  };
}
