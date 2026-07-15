export interface RegisterErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Validates registration form fields.
 *
 * Performs client-side checks that mirror backend validation rules.
 * Backend validation is still required because the frontend cannot be trusted.
 *
 * Returns an object containing validation errors.
 * An empty object means the form is valid.
 */
export function validateRegisterForm(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  confirmPassword: string,
): RegisterErrors {
  const errors: RegisterErrors = {};

  const commonPasswords = [
    "123456",
    "12345678",
    "password",
    "password123",
    "qwerty",
    "qwerty123",
  ];

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailRegex.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password.trim()) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (/^\d+$/.test(password)) {
    errors.password = "Password cannot contain only numbers.";
  } else if (commonPasswords.includes(password.toLowerCase())) {
    errors.password = "This password is too common.";
  }

  if (!confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
