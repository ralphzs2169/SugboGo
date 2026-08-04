/**
 * Checks whether any tracked form value differs from its initial value.
 *
 * @param {Object} values - Current form values.
 * @param {Object} initialValues - Original form values.
 * @param {string[]} fields - Fields to compare.
 * @returns {boolean}
 */
export function hasFormChanges(values, initialValues, fields) {
  return fields.some((field) => values[field] !== initialValues[field]);
}
