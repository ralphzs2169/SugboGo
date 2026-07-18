/**
 * Validates the reset password form.
 *
 * Returns an object containing validation errors.
 * An empty object means the form is valid.
 */

import { validatePassword } from "./passwordValidator";
export interface ResetPasswordErrors {
  password?: string;
  confirmPassword?: string;
}

export function validateResetPasswordForm(
  password: string,
  confirmPassword: string,
): ResetPasswordErrors {
  const errors: ResetPasswordErrors = {};

  const passwordError = validatePassword(password);

  if (passwordError) {
    errors.password = passwordError;
  }

  if (!confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
