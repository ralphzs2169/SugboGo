import { useState } from "react";
import axios from "axios";

import { login } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import { ApiResult } from "@/shared/api/types";
import { AuthResponse } from "../api/auth.types";
import { useVerificationStore } from "../store/verification.store";
/**
 * Custom hook for handling user login.
 */
export function useLogin() {
  const clearPendingEmail = useVerificationStore(
    (state) => state.clearPendingEmail,
  );

  /**
   * Attempts to authenticate the user with the provided credentials.
   *
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<AuthResponse  | null>}
   * Returns the login response on success, or null if authentication fails.
   */
  const handleLogin = async (
    email: string,
    password: string,
  ): Promise<ApiResult<AuthResponse>> => {
    try {
      const response = await login({
        email,
        password,
      });

      // Check if the response contains the expected authentication data
      if (!response.data) {
        throw new Error("Login response missing authentication data");
      }

      await establishSession(response.data);

      clearPendingEmail();

      return response;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: "Something went wrong. Please try again.",
        code: "UNKNOWN_ERROR",
      };
    }
  };

  return {
    handleLogin,
  };
}
