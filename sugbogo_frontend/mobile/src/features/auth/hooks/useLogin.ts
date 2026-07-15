import { useState } from "react";
import axios from "axios";

import { login } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import { useAuthStore } from "../store/auth.store";
import { AuthResult } from "../api/auth.types";
import { LoginFieldErrors } from "../api/auth.types";
/**
 * Custom hook for handling user login.
 */
export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setUser = useAuthStore((state) => state.setUser);
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
  ): Promise<AuthResult<LoginFieldErrors>> => {
    setLoading(true);

    try {
      const response = await login({
        email,
        password,
      });

      await establishSession(response);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          errors: error.response?.data,
        };
      }

      return {
        success: false,
        errors: {
          password: ["Something went wrong. Please try again."],
        },
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    handleLogin,
    loading,
  };
}
