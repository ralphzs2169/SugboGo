import { getFieldError } from "@/shared/api/errors";
import { ApiError } from "@/shared/api/types";
import { RegisterErrors } from "./registerValidator";

/**
 * Maps API error responses to a structured format for the registration form.
 * Converts backend field names from snake_case to camelCase for frontend compatibility.
 *
 * @param {ApiError} error - The error response from the API.
 *
 * @returns {RegisterErrors} - The mapped field errors for the registration form.
 */
export default function getRegisterErrors(error: ApiError): RegisterErrors {
  return {
    firstName: getFieldError(error, "first_name"),
    lastName: getFieldError(error, "last_name"),
    email: getFieldError(error, "email"),
    password: getFieldError(error, "password"),
  };
}
