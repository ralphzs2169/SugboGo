export interface ForgotPasswordErrors {
  email?: string;
}

/**
 * Validates the forgot password form.
 *
 * Returns an object containing validation errors.
 * An empty object means the form is valid.
 */
export function validateForgotPasswordForm(
  email: string,
): ForgotPasswordErrors {
  const errors: ForgotPasswordErrors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!email.includes("@") || !email.includes(".")) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}
