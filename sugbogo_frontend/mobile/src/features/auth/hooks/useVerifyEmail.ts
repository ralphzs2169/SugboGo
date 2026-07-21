import { useState } from "react";

import { verifyEmail } from "../api/auth.service";
import { ApiMessageResponse } from "@/shared/api/types";

export function useVerifyEmail() {
  const [loading, setLoading] = useState(false);

  const handleVerifyEmail = async (
    uid: string,
    token: string,
  ): Promise<ApiMessageResponse> => {
    setLoading(true);

    try {
      return await verifyEmail(uid, token);
    } finally {
      setLoading(false);
    }
  };

  return {
    handleVerifyEmail,
    loading,
  };
}
