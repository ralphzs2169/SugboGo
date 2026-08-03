/**
 * Converts a Philippine mobile number to E.164 format.
 *
 * Accepts:
 * - 09XXXXXXXXX
 * - +639XXXXXXXXX
 *
 * Returns:
 * - +639XXXXXXXXX
 */
export function normalizePhilippineMobileNumber(phoneNumber: string): string {
  const normalized = phoneNumber.trim().replace(/\s|-/g, "");

  if (normalized.startsWith("09")) {
    return `+63${normalized.slice(1)}`;
  }

  return normalized;
}
