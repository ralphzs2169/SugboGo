import { useState } from "react";
import axios from "axios";

import { resetPassword } from "../api/auth.service";
import { ApiResult } from "@/shared/api/types";

export function useResetPassword() {
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (
    uid: string,
    token: string,
    password: string,
  ): Promise<ApiResult<void>> => {
    setLoading(true);

    try {
      return await resetPassword({
        uid,
        token,
        password,
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
    handleResetPassword,
    loading,
  };
}
