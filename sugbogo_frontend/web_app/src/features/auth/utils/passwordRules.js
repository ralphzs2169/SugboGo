// A small sample of frequently used passwords, used for client-side hinting
// only. The Django backend's CommonPasswordValidator is the source of truth
// and checks against a much larger list — this just gives the user early
// feedback before they submit the form.
const COMMON_PASSWORDS = [
  "password",
  "123456",
  "123456789",
  "12345678",
  "12345",
  "qwerty",
  "abc123",
  "password1",
  "111111",
  "123123",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "qwerty123",
  "1q2w3e4r",
  "000000",
  "1234567890",
  "trustno1",
];

/**
 * Returns the list of live password requirements, mirroring the rules
 * enforced by AUTH_PASSWORD_VALIDATORS on the Django backend:
 *  - MinimumLengthValidator (default min_length=8)
 *  - NumericPasswordValidator (password can't be entirely numeric)
 *  - CommonPasswordValidator (approximated client-side with a short list)
 *
 * UserAttributeSimilarityValidator isn't checked here since it compares
 * the password against user attributes (email, name, etc.) that aren't
 * available on this form — the backend still enforces it on submit, and
 * any rejection from it will surface through the normal form error.
 */
export function getPasswordRequirements(password = "", confirmPassword = "") {
  const isEntirelyNumeric = password.length > 0 && /^\d+$/.test(password);
  const isCommon = COMMON_PASSWORDS.includes(password.toLowerCase());

  return [
    {
      id: "minLength",
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      id: "notNumeric",
      label: "Not entirely numeric",
      met: password.length > 0 && !isEntirelyNumeric,
    },
    {
      id: "notCommon",
      label: "Not a commonly used password",
      met: password.length > 0 && !isCommon,
    },
    {
      id: "matches",
      label: "Passwords match",
      met: password.length > 0 && password === confirmPassword,
    },
  ];
}
