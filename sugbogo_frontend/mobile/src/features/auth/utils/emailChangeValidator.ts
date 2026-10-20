export interface EmailChangeErrors {
  newEmail?: string;
  currentPassword?: string;
}

/** Checks form completeness without changing passwords or claiming server availability. */
export function validateEmailChange(
  newEmail: string,
  currentEmail: string,
  password: string,
): EmailChangeErrors {
  const email = newEmail.trim();
  const errors: EmailChangeErrors = {};
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 100
  ) {
    errors.newEmail = "Enter a valid email address.";
  } else if (email.toLowerCase() === currentEmail.toLowerCase()) {
    errors.newEmail = "Choose an email different from your current email.";
  }
  if (!password) errors.currentPassword = "Enter your current password.";
  return errors;
}
