import { useState } from "react";
import axios from "axios";

import { login } from "../api/auth.service";
import { LoginResponse } from "../api/auth.types";
import { saveAccessToken, saveRefreshToken } from "@/shared/api/storage";
import { useAuthStore } from "../store/auth.store";

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
   * @returns {Promise<LoginResponse | null>}
   * Returns the login response on success, or null if authentication fails.
   */
  const handleLogin = async (
    email: string,
    password: string,
  ): Promise<LoginResponse | null> => {
    setLoading(true);
    setError("");

    try {
      const response = await login({
        email,
        password,
      });

      await saveAccessToken(response.access);

      await saveRefreshToken(response.refresh);

      // Save
      setUser(response.user);

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data;

        if (typeof data?.detail === "string") {
          setError(data.detail);
        } else {
          setError("Invalid email or password.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }

      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    handleLogin,
    loading,
    error,
  };
}
