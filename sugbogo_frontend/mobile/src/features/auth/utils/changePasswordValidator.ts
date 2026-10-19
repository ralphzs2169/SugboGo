import { validatePassword } from "./passwordValidator";

export interface ChangePasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

/** Validates password replacement without altering the user's password text. */
export function validateChangePasswordForm(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  if (!currentPassword) errors.currentPassword = "Enter your current password.";
  errors.newPassword = validatePassword(newPassword);
  if (!errors.newPassword && newPassword === currentPassword) {
    errors.newPassword =
      "Choose a password different from your current password.";
  }
  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return Object.fromEntries(
    Object.entries(errors).filter(([, value]) => value !== undefined),
  );
}
