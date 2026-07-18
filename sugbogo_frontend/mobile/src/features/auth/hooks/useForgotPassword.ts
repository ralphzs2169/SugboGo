import { useState } from "react";
import axios from "axios";

import { forgotPassword } from "../api/auth.service";
import { ApiResult } from "@/shared/api/types";

export function useForgotPassword() {
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (
    email: string,
  ): Promise<ApiResult<void>> => {
    setLoading(true);

    try {
      return await forgotPassword({
        email,
      });
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
    handleForgotPassword,
    loading,
  };
}
