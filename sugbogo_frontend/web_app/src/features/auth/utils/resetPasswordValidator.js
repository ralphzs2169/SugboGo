import { validatePassword } from "./passwordValidator";

export function validateResetPassword(password, confirmPassword) {
  const errors = {};

  const passwordErrors = validatePassword(password);

  if (passwordErrors.length > 0) {
    errors.password = passwordErrors;
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
