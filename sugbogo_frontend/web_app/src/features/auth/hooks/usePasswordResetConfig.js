import { useEffect, useState } from "react";
import axios from "axios";

import { getPasswordResetConfig } from "../api/auth.service";

export function usePasswordResetConfig() {
  const [expiryHours, setExpiryHours] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await getPasswordResetConfig();

        setExpiryHours(response.data.expiry_hours);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(error.response?.data);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  return {
    expiryHours,
    loading,
  };
}
