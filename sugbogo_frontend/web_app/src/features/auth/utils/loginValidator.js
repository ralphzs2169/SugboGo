export function validateLoginForm(email, password) {
  const errors = {};

  if (!email.trim()) {
    errors.email = "Email is required.";
  } else if (!email.includes("@") || !email.includes(".")) {
    errors.email = "Enter a valid email address.";
  }

  if (!password.trim()) {
    errors.password = "Password is required.";
  }

  return errors;
}
