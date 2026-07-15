import { RegisterErrors } from "./validators";

/**
 * Represents validation errors returned by the backend registration API.
 *
 * Backend uses snake_case field names while the frontend uses camelCase.
 */
interface BackendRegisterErrors {
  first_name?: string[];
  last_name?: string[];
  email?: string[];
  password?: string[];
}

/**
 * Maps backend registration errors into frontend form errors.
 *
 * Converts Django serializer field names from snake_case to the
 * frontend's camelCase format so they can be directly used by
 * form components.
 *
 * @param {BackendRegisterErrors} errors - Validation errors returned by the backend.
 *
 * @returns {RegisterErrors}
 * Returns frontend-compatible field errors.
 */
export function mapRegisterErrors(
  errors: BackendRegisterErrors,
): RegisterErrors {
  return {
    firstName: errors.first_name?.[0],
    lastName: errors.last_name?.[0],
    email: errors.email?.[0],
    password: errors.password?.[0],
  };
}
