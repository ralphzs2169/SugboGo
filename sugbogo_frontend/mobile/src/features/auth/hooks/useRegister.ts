import { useState } from "react";
import axios from "axios";

import { register } from "../api/auth.service";
import { AuthResult } from "../api/auth.types";
import { establishSession } from "../utils/authSession";
import { RegisterFieldErrors } from "../api/auth.types";

/**
 * Custom hook for handling user registration.
 */
export function useRegister() {
  const [loading, setLoading] = useState(false);

  /**
   * Attempts to register a new user.
   *
   * @param {string} firstName - User's first name.
   * @param {string} lastName - User's last name.
   * @param {string} email - User's email address.
   * @param {string} password - User's password.
   *
   * @returns {Promise<
   *   | { success: true; data: AuthResponse }
   *   | { success: false; errors: RegisterFieldErrors }
   * >}
   *
   * Returns the authentication response on success,
   * or structured field errors if registration fails.
   */
  const handleRegister = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<AuthResult<RegisterFieldErrors>> => {
    setLoading(true);

    try {
      const response = await register({
        first_name: firstName,
        last_name: lastName,
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
          errors: error.response?.data ?? {},
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
    handleRegister,
    loading,
  };
}
