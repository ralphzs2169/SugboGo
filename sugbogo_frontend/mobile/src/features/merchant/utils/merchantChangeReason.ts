/** Apply the same trimmed reason limits as the submission API. */
export function validateMerchantChangeReason(
  value: string,
): string | undefined {
  const length = value.trim().length;
  if (length === 0) return "Please provide a reason for this change.";
  if (length < 10) return "Please enter at least 10 characters.";
  if (length > 500) return "Your reason must not exceed 500 characters.";
  return undefined;
}
