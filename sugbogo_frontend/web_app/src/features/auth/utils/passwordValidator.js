/**
 * Validates a password using frontend equivalents of Django's
 * AUTH_PASSWORD_VALIDATORS.
 *
 * @param {string} password
 * @returns {string[]}
 */
export function validatePassword(password) {
  const errors = [];

  if (!password) {
    errors.push("Password is required.");
    return errors;
  }

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  if (/^\d+$/.test(password)) {
    errors.push("Password cannot be entirely numeric.");
  }

  return errors;
}
