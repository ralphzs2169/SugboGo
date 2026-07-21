import { useState } from "react";

import { resetPassword } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/api/types";

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
