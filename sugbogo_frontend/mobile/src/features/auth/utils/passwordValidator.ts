/**
 * Validates a password against the application's password policy.
 *
 * Returns an error message if invalid, otherwise undefined.
 */
export function validatePassword(password: string): string | undefined {
  const commonPasswords = [
    "123456",
    "12345678",
    "password",
    "password123",
    "qwerty",
    "qwerty123",
  ];

  if (!password.trim()) {
    return "Password is required.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (/^\d+$/.test(password)) {
    return "Password cannot contain only numbers.";
  }

  if (commonPasswords.includes(password.toLowerCase())) {
    return "This password is too common.";
  }

  return undefined;
}
