import { useState } from "react";
import axios from "axios";

import { verifyEmail } from "../api/auth.service";
import { ApiResult } from "@/shared/api/types";

export function useVerifyEmail() {
  const [loading, setLoading] = useState(false);

  const handleVerifyEmail = async (
    uid: string,
    token: string,
  ): Promise<ApiResult<void>> => {
    setLoading(true);

    try {
      return await verifyEmail(uid, token);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: "Something went wrong.",
        code: "UNKNOWN_ERROR",
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    handleVerifyEmail,
    loading,
  };
}
