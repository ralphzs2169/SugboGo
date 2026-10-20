/** Isolates the current dashboard timeline by account, independent of analytics and inbox keys. */
export function merchantRecentActivityKey(accountId: number | undefined) {
  return ["merchant-dashboard", accountId, "recent-activity"] as const;
}
