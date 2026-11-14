export interface RegisterErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
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
): RegisterErrors {
  const errors: RegisterErrors = {};

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

  return errors;
}
