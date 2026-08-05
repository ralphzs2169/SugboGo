/**
 * Validates category form values.
 *
 * @param {Object} values - The form values to validate.
 * @returns {Object} An object containing validation errors, if any.
 */
export function validateCategory(values) {
  const errors = {};

  const name = values.name?.trim() ?? "";

  if (!name) {
    errors.name = "Category name is required.";
  } else if (name.length > 100) {
    errors.name = "Category name must not exceed 100 characters.";
  }

  if (!values.cluster_id) {
    errors.cluster_id = "Please select a cluster.";
  }

  return errors;
}
