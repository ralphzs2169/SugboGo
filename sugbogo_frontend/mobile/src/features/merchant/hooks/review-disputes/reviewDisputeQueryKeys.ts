export const reviewDisputeKeys = {
  all: ["merchant-review-disputes"] as const,
  list: () => [...reviewDisputeKeys.all, "list"] as const,
  detail: (disputeId: number) =>
    [...reviewDisputeKeys.all, "detail", disputeId] as const,
};
