/**
 * Normalizes optional text values before comparison.
 *
 * Empty strings, null, and undefined are treated as the same value.
 */
export function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value == null || value.trim() === "") {
    return null;
  }

  return value;
}
