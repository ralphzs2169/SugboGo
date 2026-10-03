export const merchantClassificationChangeKeys = {
  all: ["merchant-classification-changes"] as const,
  list: (userId: number | undefined) =>
    [...merchantClassificationChangeKeys.all, "list", userId] as const,
  detail: (userId: number | undefined, requestId: number) =>
    [
      ...merchantClassificationChangeKeys.all,
      "detail",
      userId,
      requestId,
    ] as const,
};
