import { useState } from "react";

import { forgotPassword } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/api/types";

export function useResendPasswordReset() {
  const [loading, setLoading] = useState(false);

  const handleResendPasswordReset = async (
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
    handleResendPasswordReset,
    loading,
  };
}
