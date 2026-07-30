export const MerchantRegistrationStatus = {
  NONE: "NONE",
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
} as const;

export type MerchantRegistrationStatus =
  (typeof MerchantRegistrationStatus)[keyof typeof MerchantRegistrationStatus];
