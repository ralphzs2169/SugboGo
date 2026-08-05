/**
 * Validates cluster form values.
 *
 * @param {Object} values - The form values to validate.
 * @returns {Object} An object containing validation errors, if any.
 */
export function validateCluster(values) {
  const errors = {};

  const name = values.name?.trim() ?? "";

  if (!name) {
    errors.name = "Cluster name is required.";
  } else if (name.length > 100) {
    errors.name = "Cluster name must not exceed 100 characters.";
  }

  return errors;
}
