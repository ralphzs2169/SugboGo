export const reviewDisputeKeys = {
  all: ["merchant-review-disputes"] as const,
  list: () => [...reviewDisputeKeys.all, "list"] as const,
  collection: (status: string) =>
    [...reviewDisputeKeys.list(), "pages", status] as const,
  pendingCount: () => [...reviewDisputeKeys.list(), "pending-count"] as const,
  detail: (disputeId: number) =>
    [...reviewDisputeKeys.all, "detail", disputeId] as const,
};
