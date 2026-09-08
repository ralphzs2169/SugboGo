/**
 * Converts an underscore-separated value into a readable display label.
 */
export function formatLabel(value, fallback = "—") {
  if (!value) {
    return fallback;
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
