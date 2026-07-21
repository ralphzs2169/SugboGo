export function validateEmail(email) {
  const errors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!email.includes("@") || !email.includes(".")) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}
