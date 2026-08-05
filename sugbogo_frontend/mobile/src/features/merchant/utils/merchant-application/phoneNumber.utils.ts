/**
 * Converts a Philippine mobile number to E.164 format.
 *
 * Accepts:
 *   09171234567
 *   0917 123 4567
 *   639171234567
 *   +639171234567
 *
 * Returns:
 * - +639XXXXXXXXX
 */
export function normalizePhilippineMobileNumber(phoneNumber: string): string {
  const normalized = phoneNumber.trim().replace(/[\s-]/g, "");

  if (normalized.startsWith("+63")) {
    return normalized;
  }

  if (normalized.startsWith("63")) {
    return `+${normalized}`;
  }

  if (normalized.startsWith("09")) {
    return `+63${normalized.slice(1)}`;
  }

  return normalized;
}
