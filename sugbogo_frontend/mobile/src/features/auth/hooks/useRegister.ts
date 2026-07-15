import { useState } from "react";
import axios from "axios";

import { register } from "../api/auth.service";
import { AuthResponse } from "../api/auth.types";
import { establishSession } from "../utils/authSession";
import { getApiErrorMessage } from "@/shared/api/error";

/**
 * Custom hook for handling user registration.
 */
export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Attempts to register a new user.
   *
   * @returns {Promise<AuthResponse | null>}
   * Returns the authentication response on success,
   * or null if registration fails.
   */
  const handleRegister = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<AuthResponse | null> => {
    setLoading(true);
    setError("");

    try {
      const response = await register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });

      await establishSession(response);

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(getApiErrorMessage(error.response?.data));
      } else {
        setError("Something went wrong. Please try again.");
      }

      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    handleRegister,
    loading,
    error,
  };
}
