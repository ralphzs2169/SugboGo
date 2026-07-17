import { useState } from "react";
import axios from "axios";

import { register } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import { AuthResponse, RegisterFieldErrors } from "../api/auth.types";
import { useVerificationStore } from "../store/verification.store";
import { ApiResult } from "@/shared/api/types";

/**
 * Custom hook for handling user registration.
 */
export function useRegister() {
  const [loading, setLoading] = useState(false);

  const setPendingEmail = useVerificationStore(
    (state) => state.setPendingEmail,
  );
  /**
   * Attempts to register a new user.
   *
   * @param {string} firstName - User's first name.
   * @param {string} lastName - User's last name.
   * @param {string} email - User's email address.
   * @param {string} password - User's password.
   *
   * @returns {Promise<ApiResult<AuthResponse>>}
   *
   * Returns the authentication response on success,
   * or structured field errors if registration fails.
   */
  const handleRegister = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<ApiResult<AuthResponse>> => {
    setLoading(true);

    try {
      const response = await register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });

      setPendingEmail(email);
      console.log("Pending verification email:", email);

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (axios.isAxiosError(error) && error.response?.data) {
          return error.response.data;
        }
      }

      return {
        success: false,
        message: "Something went wrong. Please try again.",
        code: "UNKNOWN_ERROR",
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
