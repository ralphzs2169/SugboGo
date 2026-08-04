/**
 * Validates specialty tag form values.
 * @param {Object} values - The form values to validate.
 * @returns {Object} An object containing validation errors, if any.
 */
export function validateSpecialtyTag(values) {
  const errors = {};

  const name = values.name?.trim() ?? "";

  if (!name) {
    errors.name = "Specialty tag name is required.";
  } else if (name.length > 100) {
    errors.name = "Specialty tag name must not exceed 100 characters.";
  }

  return errors;
}
