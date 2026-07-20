import { useState } from "react";
import axios from "axios";

import { login } from "../api/auth.service";
import { establishSession } from "../utils/auth.utils";

export function useLogin() {
  const [loading, setLoading] = useState(false);

  async function handleLogin(email, password) {
    setLoading(true);

    try {
      const response = await login({
        email,
        password,
      });

      if (!response.success) {
        return response;
      }

      await establishSession(response.data);

      return response;

      return response;
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
  }

  return {
    handleLogin,
    loading,
  };
}
