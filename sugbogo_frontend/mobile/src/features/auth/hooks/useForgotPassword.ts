import { useState } from "react";

import { forgotPassword } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/api/types";

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
    } catch (error) {
      console.error("Unexpected forgot password error:", error);

      return {
        success: false,
        message: "Something unexpected happened. Please try again.",
        code: "UNKNOWN_ERROR",
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    handleForgotPassword,
    loading,
  };
}
