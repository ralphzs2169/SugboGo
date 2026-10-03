/** Identifies the authenticated merchant's approved business profile. */
export const merchantBusinessProfileKey = (userId: number | undefined) =>
  ["merchant-business-profile", userId] as const;
