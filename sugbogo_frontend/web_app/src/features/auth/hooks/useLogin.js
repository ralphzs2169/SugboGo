import { useState } from "react";

import { login } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import { getSessionGeneration } from "@/shared/api/storage";
import { staleSessionError } from "@/shared/api/refresh";

/**
 * Handles administrator authentication while preserving the API response
 * so the login form can distinguish validation, authentication, and
 * temporary request errors.
 */
export function useLogin() {
  const [loading, setLoading] = useState(false);

  async function handleLogin(
    email,
    password,
  ) {
    const generation = getSessionGeneration();
    setLoading(true);

    try {
      const response = await login({
        email,
        password,
      });

      if (generation !== getSessionGeneration()) {
        throw staleSessionError();
      }

      if (!response.success) {
        return response;
      }

      await establishSession(response.data);

      return response;
    } catch (error) {
      if (error.name === "STALE_AUTH_SESSION") {
        return {
          success: false,
          message: "Your session changed. Please try again.",
          code: "STALE_AUTH_SESSION",
        };
      }
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
