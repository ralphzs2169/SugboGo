/** Accepts only a single known navigation hint without inferring financial state. */
export function parseMerchantPlusReturnOutcome(value: unknown) {
  if (value === "success" || value === "failure" || value === "cancel") {
    return value;
  }
  return null;
}
