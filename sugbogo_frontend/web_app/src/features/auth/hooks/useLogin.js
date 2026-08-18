import { useState } from "react";

import { login } from "../api/auth.service";
import { establishSession } from "../utils/authSession";

/**
 * Handles administrator authentication while preserving the API response
 * so the login form can distinguish validation, authentication, and
 * temporary request errors.
 */
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
    } catch (error) {
      const responseData = error.response?.data;

      if (responseData) {
        return responseData;
      }

      return {
        success: false,
        message: "Unable to connect to the server. Please try again.",
        code: "NETWORK_ERROR",
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
