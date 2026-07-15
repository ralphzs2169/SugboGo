export interface LoginErrors {
  email?: string;
  password?: string;
}

/**
 * Validates login form fields.
 *
 * Returns an object containing validation errors.
 * An empty object means the form is valid.
 */
export function validateLoginForm(
  email: string,
  password: string,
): LoginErrors {
  const errors: LoginErrors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!email.includes("@") || !email.includes(".")) {
    errors.email = "Enter a valid email address.";
  }

  if (!password.trim()) {
    errors.password = "Password is required.";
  }

  return errors;
}
