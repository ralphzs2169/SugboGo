/** Identifies pending business change flags for one merchant account. */
export const businessChangePendingStatusQueryKey = (
  userId: number | undefined,
) => ["merchant-business-change-pending-status", userId] as const;
